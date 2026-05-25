import type { JWT } from "google-auth-library";
import { log } from "../../lib/logger.js";

/**
 * Thin, typed REST client for Google Sheets v4.
 *
 * Keeps the surface area deliberately narrow: only the calls this store needs,
 * plus the calls the init script needs. Every network call goes through
 * `request()` so retry/backoff and log redaction live in exactly one place.
 *
 * Security notes:
 * - Request and response bodies are never logged (they contain lead PII; the
 *   access token lives in headers and would leak via any body dump).
 * - Errors include the HTTP status + a one-line API message but never echo
 *   the request body.
 * - Retries use full jitter to avoid synchronised retry storms across replicas.
 */

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export interface SheetsClientOptions {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Max retry attempts on retryable failures (429, 5xx, network). Default 4. */
  maxRetries?: number;
  /** Base backoff in ms. Each retry waits up to base × 2^attempt × jitter. */
  baseBackoffMs?: number;
}

// ── API value shapes (only what we use) ────────────────────────────────────

export type CellValue = string | number | boolean | null;

export interface ValueRange {
  range?: string;
  majorDimension?: "ROWS" | "COLUMNS";
  values?: CellValue[][];
}

export interface BatchValueUpdate {
  /** Sheets `valueInputOption` — RAW preserves strings literally (no formula eval). */
  valueInputOption: "RAW" | "USER_ENTERED";
  data: ValueRange[];
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  properties: { title: string; locale?: string; timeZone?: string };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
      hidden?: boolean;
      gridProperties?: { rowCount?: number; columnCount?: number; frozenRowCount?: number };
    };
  }>;
}

/** A request to spreadsheets.batchUpdate (the formatting one). We type it as
 * `unknown` because the surface is enormous and we build requests by hand. */
export type BatchUpdateRequest = Record<string, unknown>;

export class SheetsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  constructor(
    private readonly jwt: JWT,
    opts: SheetsClientOptions = {},
  ) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetries = opts.maxRetries ?? 4;
    this.baseBackoffMs = opts.baseBackoffMs ?? 250;
  }

  // ── Values ──────────────────────────────────────────────────────────────

  /** Read a range. Returns `[]` if the range exists but is empty. */
  async getValues(
    spreadsheetId: string,
    range: string,
    opts: { valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" } = {},
  ): Promise<CellValue[][]> {
    const params = new URLSearchParams({
      majorDimension: "ROWS",
      valueRenderOption: opts.valueRenderOption ?? "UNFORMATTED_VALUE",
    });
    const url = `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?${params}`;
    const body = (await this.request<ValueRange>("GET", url)) ?? {};
    return body.values ?? [];
  }

  /** Atomic multi-range write. Cheaper and safer than N independent calls. */
  async batchUpdateValues(spreadsheetId: string, update: BatchValueUpdate): Promise<void> {
    const url = `${BASE}/${spreadsheetId}/values:batchUpdate`;
    await this.request("POST", url, update);
  }

  // ── Spreadsheet metadata + structure ────────────────────────────────────

  async getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetMeta> {
    const url = `${BASE}/${spreadsheetId}?includeGridData=false`;
    const meta = await this.request<SpreadsheetMeta>("GET", url);
    if (!meta) throw new Error("sheets.get: empty response");
    return meta;
  }

  /** Provisioning + formatting changes (createSheet, repeatCell, addProtectedRange, etc.). */
  async batchUpdateSpreadsheet(
    spreadsheetId: string,
    requests: BatchUpdateRequest[],
  ): Promise<unknown> {
    const url = `${BASE}/${spreadsheetId}:batchUpdate`;
    return this.request("POST", url, { requests });
  }

  /** Create a new spreadsheet (used by the init script when no ID is supplied). */
  async createSpreadsheet(title: string): Promise<SpreadsheetMeta> {
    const meta = await this.request<SpreadsheetMeta>("POST", BASE, {
      properties: { title },
    });
    if (!meta) throw new Error("sheets.create: empty response");
    return meta;
  }

  // ── Plumbing ────────────────────────────────────────────────────────────

  private async request<T = unknown>(
    method: "GET" | "POST",
    url: string,
    body?: unknown,
  ): Promise<T | null> {
    const token = await this.jwt.getAccessToken();
    if (!token.token) throw new Error("sheets.auth: failed to obtain access token");

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        // Network-level error. Retry if attempts remain.
        if (attempt < this.maxRetries) {
          await sleep(this.backoffMs(attempt));
          continue;
        }
        throw new Error(`sheets.network: ${(err as Error).message}`);
      }

      if (res.ok) {
        if (res.status === 204) return null;
        return (await res.json()) as T;
      }

      const retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
      if (retryable && attempt < this.maxRetries) {
        log.warn("sheets.retry", { status: res.status, attempt });
        await sleep(this.backoffMs(attempt));
        continue;
      }

      // Surface the API message but never the request body.
      const apiMessage = await safeApiMessage(res);
      throw new SheetsApiError(res.status, apiMessage);
    }

    // Unreachable — the loop returns or throws — but TypeScript can't see it.
    throw new Error("sheets.request: exhausted retries");
  }

  private backoffMs(attempt: number): number {
    // Full-jitter exponential backoff: random in [0, base * 2^attempt].
    const ceiling = this.baseBackoffMs * 2 ** attempt;
    return Math.floor(Math.random() * ceiling);
  }
}

export class SheetsApiError extends Error {
  constructor(
    readonly status: number,
    readonly apiMessage: string,
  ) {
    super(`sheets.api ${status}: ${apiMessage}`);
    this.name = "SheetsApiError";
  }
}

async function safeApiMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return j.error?.message ?? res.statusText;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
