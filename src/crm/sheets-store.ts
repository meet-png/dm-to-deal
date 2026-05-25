import { randomUUID } from "node:crypto";
import type { Lead, LeadCapture, Message } from "../domain/types.js";
import { log } from "../lib/logger.js";
import { authFromEnv } from "./sheets/auth.js";
import { decodeRow, encodeRow } from "./sheets/codec.js";
import { SheetsClient, type CellValue } from "./sheets/client.js";
import { LEADS_COLUMNS, TAB, colIndex, colLetter } from "./sheets/schema.js";
import type { LeadStore } from "./types.js";

/**
 * Google Sheets-backed lead store — the V1 dashboard *is* the database.
 *
 * Design choices:
 * - Reads of the Leads tab are cached briefly (`indexTtlMs`) so a burst of
 *   webhooks doesn't fan out to N round-trips per message. The cache is
 *   invalidated on any write.
 * - Writes go through `values.batchUpdate` with `valueInputOption=RAW`. RAW
 *   disables Sheets' formula/date parsing, which is our primary defence
 *   against formula injection from lead-controlled text. The codec adds a
 *   belt-and-braces defang on `=+-@` leading chars in case a human flips the
 *   sheet to USER_ENTERED via the UI later.
 * - Concurrency model: Phase 1 is single-instance. If two webhooks for the
 *   same handle race, the second `append`/`update` may clobber the first
 *   (last-write-wins). When we go multi-instance this will move to Redis +
 *   optimistic concurrency (per `docs/ROADMAP.md`).
 */

export interface SheetsConfig {
  spreadsheetId: string;
  /** Path to service-account JSON, or the JSON itself (cloud deploys). */
  serviceAccountSource: string;
  /** How long to trust the handle→row cache. Default 30s. */
  indexTtlMs?: number;
  /** Test injection for the Sheets client. */
  client?: SheetsClient;
}

/** Internal row record — Lead plus its row number on the Leads tab. */
interface RowEntry {
  rowNumber: number; // 1-based; data starts at row 2
  lead: Lead;
}

const HEADER_ROWS = 1;
const FIRST_COL = "A";
const LAST_COL = colLetter(LEADS_COLUMNS.length - 1);
const ROW_RANGE = (row: number) => `${TAB.LEADS}!${FIRST_COL}${row}:${LAST_COL}${row}`;
const FULL_DATA_RANGE = `${TAB.LEADS}!${FIRST_COL}${HEADER_ROWS + 1}:${LAST_COL}`;

export class SheetsLeadStore implements LeadStore {
  private readonly spreadsheetId: string;
  private readonly indexTtlMs: number;
  private clientPromise: Promise<SheetsClient> | null = null;
  private readonly preloadedClient?: SheetsClient;
  private readonly source: string;

  /** Lower-cased IG handle → row entry. */
  private cache: Map<string, RowEntry> = new Map();
  private cacheLoadedAt = 0;
  /** In-flight load to coalesce concurrent reads. */
  private loadInFlight: Promise<void> | null = null;

  constructor(config: SheetsConfig) {
    if (!config.spreadsheetId) throw new Error("Sheets: spreadsheetId is required");
    if (!config.serviceAccountSource) {
      throw new Error("Sheets: serviceAccountSource is required (file path or inline JSON)");
    }
    this.spreadsheetId = config.spreadsheetId;
    this.source = config.serviceAccountSource;
    this.indexTtlMs = config.indexTtlMs ?? 30_000;
    this.preloadedClient = config.client;
  }

  // ── LeadStore implementation ───────────────────────────────────────────

  async upsertCapture(capture: LeadCapture): Promise<Lead> {
    await this.ensureLoaded();
    const key = capture.igHandle.toLowerCase();
    const existing = this.cache.get(key);
    if (existing) return cloneLead(existing.lead);

    const now = new Date().toISOString();
    const lead: Lead = {
      id: randomUUID(),
      igHandle: capture.igHandle,
      name: capture.name,
      sourceContent: capture.sourceContent,
      stage: "New",
      sentiment: "warm",
      transcript: [],
      firstContactAt: now,
      lastMessageAt: now,
    };

    const rowNumber = this.nextRowNumber();
    await this.writeRow(rowNumber, lead);
    this.cache.set(key, { rowNumber, lead });
    return cloneLead(lead);
  }

  async getByHandle(igHandle: string): Promise<Lead | undefined> {
    await this.ensureLoaded();
    const entry = this.cache.get(igHandle.toLowerCase());
    return entry ? cloneLead(entry.lead) : undefined;
  }

  async append(igHandle: string, message: Message): Promise<Lead> {
    await this.ensureLoaded();
    const key = igHandle.toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) throw new Error(`SheetsLeadStore.append: no lead for handle ${igHandle}`);

    entry.lead.transcript.push(message);
    entry.lead.lastMessageAt = message.at;
    await this.writeRow(entry.rowNumber, entry.lead);
    return cloneLead(entry.lead);
  }

  async update(lead: Lead): Promise<Lead> {
    await this.ensureLoaded();
    const key = lead.igHandle.toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) throw new Error(`SheetsLeadStore.update: unknown handle ${lead.igHandle}`);
    entry.lead = { ...lead, transcript: [...lead.transcript] };
    await this.writeRow(entry.rowNumber, entry.lead);
    return cloneLead(entry.lead);
  }

  async staleLeads(before: Date): Promise<Lead[]> {
    await this.ensureLoaded();
    const cutoff = before.getTime();
    const active = new Set(["New", "Engaged", "Qualifying", "Objection", "BookingSent"]);
    return [...this.cache.values()]
      .filter(
        (e) =>
          active.has(e.lead.stage) && new Date(e.lead.lastMessageAt).getTime() < cutoff,
      )
      .map((e) => cloneLead(e.lead));
  }

  async all(): Promise<Lead[]> {
    await this.ensureLoaded();
    return [...this.cache.values()].map((e) => cloneLead(e.lead));
  }

  // ── Plumbing ───────────────────────────────────────────────────────────

  private async client(): Promise<SheetsClient> {
    if (this.preloadedClient) return this.preloadedClient;
    if (!this.clientPromise) {
      this.clientPromise = authFromEnv(this.source).then(({ jwt }) => new SheetsClient(jwt));
    }
    return this.clientPromise;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loadInFlight) return this.loadInFlight;
    if (Date.now() - this.cacheLoadedAt < this.indexTtlMs && this.cache.size > 0) return;
    this.loadInFlight = this.load().finally(() => {
      this.loadInFlight = null;
    });
    return this.loadInFlight;
  }

  private async load(): Promise<void> {
    const client = await this.client();
    const rows = await client.getValues(this.spreadsheetId, FULL_DATA_RANGE);
    const next = new Map<string, RowEntry>();
    rows.forEach((cells, i) => {
      // Skip blank rows so a manually-cleared row doesn't crash decode.
      if (!cells || cells.length === 0 || isRowBlank(cells)) return;
      try {
        const lead = decodeRow(cells);
        if (!lead.igHandle) return;
        next.set(lead.igHandle.toLowerCase(), {
          rowNumber: HEADER_ROWS + 1 + i,
          lead,
        });
      } catch (err) {
        log.warn("sheets.load.skipRow", {
          row: HEADER_ROWS + 1 + i,
          reason: (err as Error).message,
        });
      }
    });
    this.cache = next;
    this.cacheLoadedAt = Date.now();
  }

  private nextRowNumber(): number {
    let max = HEADER_ROWS;
    for (const entry of this.cache.values()) {
      if (entry.rowNumber > max) max = entry.rowNumber;
    }
    return max + 1;
  }

  private async writeRow(rowNumber: number, lead: Lead): Promise<void> {
    const client = await this.client();
    const values = [encodeRow(lead)];
    await client.batchUpdateValues(this.spreadsheetId, {
      valueInputOption: "RAW",
      data: [{ range: ROW_RANGE(rowNumber), values }],
    });
    log.debug("sheets.write", { row: rowNumber, leadId: lead.id });
  }
}

function isRowBlank(cells: CellValue[]): boolean {
  const idIdx = colIndex("leadId");
  const handleIdx = colIndex("igHandle");
  return !cells[idIdx] && !cells[handleIdx];
}

/**
 * Defensive deep copy — callers (and the orchestrator) sometimes mutate Lead
 * fields in place. The store must never hand out its internal references.
 */
function cloneLead(lead: Lead): Lead {
  return { ...lead, transcript: lead.transcript.map((m) => ({ ...m })) };
}
