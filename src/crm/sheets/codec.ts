import type { Lead, Message, Sentiment, Stage } from "../../domain/types.js";
import { STAGES, SENTIMENTS } from "../../domain/types.js";
import {
  LEADS_COLUMNS,
  STATE_VERSION,
  colIndex,
  type ColumnKey,
} from "./schema.js";
import type { CellValue } from "./client.js";

/**
 * Encode/decode `Lead` ↔ spreadsheet row.
 *
 * Security:
 * - `valueInputOption=RAW` on writes means Sheets never parses strings as
 *   formulas, dates, or anything else. That alone blocks the classic formula-
 *   injection vector (`=HYPERLINK(...)` in a `name` field).
 * - As belt-and-braces we still defang strings that start with `=+-@\t\r` —
 *   if a human ever flips the sheet to USER_ENTERED via the UI, our data is
 *   still safe. The defang is invisible on read (Sheets eats the leading `'`).
 * - The hidden `__state` column carries a JSON blob with the full transcript.
 *   We tag it with a version byte so a future schema change is detectable
 *   instead of silently misinterpreted.
 *
 * Dates are written as Sheets serial numbers (days since 1899-12-30) so the
 * column's number format renders them natively. ISO strings would have worked
 * but lose the per-locale rendering the influencer expects in a CRM.
 */

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
/** Soft cap on transcript size to fit comfortably in a Sheets cell (50k limit). */
const MAX_TRANSCRIPT_MESSAGES = 200;

// ── Public surface ─────────────────────────────────────────────────────────

export function encodeRow(lead: Lead): CellValue[] {
  const cells: CellValue[] = new Array(LEADS_COLUMNS.length).fill("");
  set(cells, "leadId", lead.id);
  set(cells, "igHandle", defang(lead.igHandle));
  set(cells, "name", defangOpt(lead.name));
  set(cells, "sourceContent", defangOpt(lead.sourceContent));
  set(cells, "stage", lead.stage);
  set(cells, "sentiment", lead.sentiment);
  set(cells, "firstContact", isoToSerial(lead.firstContactAt));
  set(cells, "lastMessage", isoToSerial(lead.lastMessageAt));
  set(cells, "bookingSentAt", lead.bookingLinkSentAt ? isoToSerial(lead.bookingLinkSentAt) : "");
  set(cells, "revenue", lead.revenue ?? "");
  set(cells, "messages", lead.transcript.length);
  set(cells, "lastReply", defang(lastReplyPreview(lead)));
  set(cells, "state", encodeState(lead));
  return cells;
}

export function decodeRow(cells: CellValue[]): Lead {
  const get = (key: ColumnKey): CellValue => cells[colIndex(key)] ?? "";
  const state = decodeState(asString(get("state")));

  const stage = asEnum<Stage>(get("stage"), STAGES, "New");
  const sentiment = asEnum<Sentiment>(get("sentiment"), SENTIMENTS, "warm");
  const revenueCell = get("revenue");

  return {
    id: asString(get("leadId")),
    igHandle: asString(get("igHandle")),
    name: asOptString(get("name")),
    sourceContent: asOptString(get("sourceContent")),
    stage,
    sentiment,
    transcript: state.transcript,
    firstContactAt: cellToIso(get("firstContact")),
    lastMessageAt: cellToIso(get("lastMessage")),
    bookingLinkSentAt: cellToOptIso(get("bookingSentAt")),
    revenue: typeof revenueCell === "number" ? revenueCell : undefined,
  };
}

// ── State (hidden JSON column) ─────────────────────────────────────────────

interface StateBlob {
  v: typeof STATE_VERSION;
  transcript: Message[];
}

function encodeState(lead: Lead): string {
  const transcript = lead.transcript.slice(-MAX_TRANSCRIPT_MESSAGES);
  const blob: StateBlob = { v: STATE_VERSION, transcript };
  return JSON.stringify(blob);
}

function decodeState(raw: string): StateBlob {
  if (!raw) return { v: STATE_VERSION, transcript: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { v: STATE_VERSION, transcript: [] };
  }
  if (!parsed || typeof parsed !== "object") return { v: STATE_VERSION, transcript: [] };
  const obj = parsed as Partial<StateBlob>;
  if (obj.v !== STATE_VERSION) {
    // Forward-compat hook: today we treat unknown versions as empty rather
    // than risk corrupting data. Future code can branch on `obj.v` here.
    return { v: STATE_VERSION, transcript: [] };
  }
  const transcript = Array.isArray(obj.transcript) ? obj.transcript.filter(isMessage) : [];
  return { v: STATE_VERSION, transcript };
}

function isMessage(m: unknown): m is Message {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return (
    (o.role === "lead" || o.role === "agent") &&
    typeof o.text === "string" &&
    typeof o.at === "string"
  );
}

// ── Helpers: safe string handling ──────────────────────────────────────────

/**
 * Prefix any leading char that Sheets might interpret as a formula start
 * (`= + - @ \t \r`) with `'` — a literal quote that Sheets consumes on
 * display, so the round-trip is invisible. Belt-and-braces alongside RAW
 * `valueInputOption`.
 */
function defang(s: string): string {
  if (s.length === 0) return s;
  const first = s.charCodeAt(0);
  // = + - @  \t \r
  if (first === 61 || first === 43 || first === 45 || first === 64 || first === 9 || first === 13) {
    return "'" + s;
  }
  return s;
}

function defangOpt(s: string | undefined): string {
  return s === undefined ? "" : defang(s);
}

function set(cells: CellValue[], key: ColumnKey, value: CellValue): void {
  cells[colIndex(key)] = value;
}

function asString(v: CellValue): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function asOptString(v: CellValue): string | undefined {
  const s = asString(v).trim();
  return s.length === 0 ? undefined : s;
}

function asEnum<T extends string>(v: CellValue, allowed: readonly T[], fallback: T): T {
  const s = asString(v).trim() as T;
  return (allowed as readonly string[]).includes(s) ? s : fallback;
}

// ── Date conversion ────────────────────────────────────────────────────────

export function isoToSerial(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return (ms - SHEETS_EPOCH_MS) / MS_PER_DAY;
}

export function serialToIso(serial: number): string {
  return new Date(SHEETS_EPOCH_MS + serial * MS_PER_DAY).toISOString();
}

function cellToIso(v: CellValue): string {
  if (typeof v === "number") return serialToIso(v);
  if (typeof v === "string" && v.length > 0) {
    const ms = Date.parse(v);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function cellToOptIso(v: CellValue): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return cellToIso(v);
}

// ── Preview text ───────────────────────────────────────────────────────────

function lastReplyPreview(lead: Lead): string {
  const last = lead.transcript[lead.transcript.length - 1];
  if (!last) return "";
  const who = last.role === "agent" ? "→" : "←";
  const text = last.text.replace(/\s+/g, " ").trim();
  const capped = text.length > 300 ? text.slice(0, 297) + "…" : text;
  return `${who} ${capped}`;
}
