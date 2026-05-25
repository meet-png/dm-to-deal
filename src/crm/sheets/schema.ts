import type { Stage, Sentiment } from "../../domain/types.js";

/**
 * The single source of truth for the spreadsheet's shape and *look*.
 *
 * The provisioning script and the runtime store both read from this file, so
 * if you change a column order or a color, every caller stays consistent.
 *
 * Design language: "Signal" — the same near-black + acid-lime accent as the
 * web app (`web/tailwind.config.ts`). The body of the sheet stays light so
 * it's readable as a working CRM; the header band, dashboard panel, and Won
 * row carry the brand.
 */

export const TAB = {
  DASHBOARD: "Dashboard",
  LEADS: "Leads",
  BOOKINGS: "Bookings",
  REVENUE: "Revenue",
} as const;

/** Letter-coded for human reference; index drives the actual API calls. */
export interface ColumnSpec {
  key: ColumnKey;
  header: string;
  /** Pixel width — premium typographic rhythm, not autofit. */
  width: number;
  /** Number-format pattern (Sheets API). Omit for plain string. */
  numberFormat?: { type: "DATE_TIME" | "CURRENCY" | "NUMBER" | "TEXT"; pattern: string };
  /** Hide the column from the influencer (machine-readable state). */
  hidden?: boolean;
  /** Right-align numerics, left-align text. */
  align?: "LEFT" | "CENTER" | "RIGHT";
  /** Render this cell in monospace (IDs, timestamps). */
  mono?: boolean;
}

export type ColumnKey =
  | "leadId"
  | "igHandle"
  | "name"
  | "sourceContent"
  | "stage"
  | "sentiment"
  | "firstContact"
  | "lastMessage"
  | "bookingSentAt"
  | "revenue"
  | "messages"
  | "lastReply"
  | "state";

/**
 * Columns on the Leads tab, left-to-right. Order is load-bearing — the row
 * codec encodes by this order and the provisioner formats by index.
 */
export const LEADS_COLUMNS: readonly ColumnSpec[] = [
  { key: "leadId", header: "Lead ID", width: 110, mono: true, align: "LEFT" },
  { key: "igHandle", header: "IG Handle", width: 180, align: "LEFT" },
  { key: "name", header: "Name", width: 140, align: "LEFT" },
  { key: "sourceContent", header: "Source", width: 180, align: "LEFT" },
  { key: "stage", header: "Stage", width: 130, align: "CENTER" },
  { key: "sentiment", header: "Sentiment", width: 110, align: "CENTER" },
  {
    key: "firstContact",
    header: "First Contact",
    width: 150,
    numberFormat: { type: "DATE_TIME", pattern: "ddd, mmm d  h:mm am/pm" },
    mono: true,
    align: "LEFT",
  },
  {
    key: "lastMessage",
    header: "Last Message",
    width: 150,
    numberFormat: { type: "DATE_TIME", pattern: "ddd, mmm d  h:mm am/pm" },
    mono: true,
    align: "LEFT",
  },
  {
    key: "bookingSentAt",
    header: "Booking Sent",
    width: 150,
    numberFormat: { type: "DATE_TIME", pattern: "ddd, mmm d  h:mm am/pm" },
    mono: true,
    align: "LEFT",
  },
  {
    key: "revenue",
    header: "Revenue",
    width: 110,
    numberFormat: { type: "CURRENCY", pattern: '"$"#,##0' },
    align: "RIGHT",
    mono: true,
  },
  { key: "messages", header: "Msgs", width: 60, align: "CENTER", mono: true },
  { key: "lastReply", header: "Last Reply", width: 380, align: "LEFT" },
  { key: "state", header: "__state", width: 80, hidden: true, mono: true },
] as const;

/** Look up a column's 0-based index by its key. Throws if unknown. */
export function colIndex(key: ColumnKey): number {
  const i = LEADS_COLUMNS.findIndex((c) => c.key === key);
  if (i < 0) throw new Error(`schema: unknown column key "${key}"`);
  return i;
}

/** A1 letter for a 0-based column index ("A", "B", ..., "AA"). */
export function colLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

// ── Palette ────────────────────────────────────────────────────────────────

/** Hex → Sheets `Color` (0-1 floats). */
export function hex(input: string): { red: number; green: number; blue: number } {
  const h = input.replace("#", "");
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/**
 * Stage palette — calm pastels so the sheet remains a working CRM, except for
 * Won which uses the brand acid-lime as a deliberate moment of celebration.
 */
export const STAGE_FILL: Record<Stage, string> = {
  New: "#F1F5F9", // slate-100
  Engaged: "#DBEAFE", // blue-100
  Qualifying: "#CCFBF1", // teal-100
  Objection: "#FEF3C7", // amber-100
  BookingSent: "#DDD6FE", // violet-100
  Booked: "#BBF7D0", // green-200
  Won: "#C6F24E", // signal — the brand moment
  Lost: "#E5E5E5", // neutral-200 (muted; loss isn't punished visually)
};

export const SENTIMENT_FILL: Record<Sentiment, string> = {
  hot: "#FFE4E1", // ghost of the brand hot
  warm: "#FEF3C7", // ghost of warm
  cold: "#DBE5FF", // ghost of cold
};

export const SENTIMENT_TEXT: Record<Sentiment, string> = {
  hot: "#B91C1C",
  warm: "#92400E",
  cold: "#1E3A8A",
};

/** Header band — near-black with bright text. Mirrors the app's `ink-900`. */
export const HEADER_FILL = "#101013";
export const HEADER_TEXT = "#EDEDED";
/** Subtle banded rows for body readability. */
export const BAND_FILL = "#FAFAFB";
export const BORDER_HAIRLINE = "#E5E5E5";

/** Brand accent. */
export const SIGNAL = "#C6F24E";

// ── Stage / sentiment domains for validation dropdowns ─────────────────────

export const STAGE_VALUES: readonly Stage[] = [
  "New",
  "Engaged",
  "Qualifying",
  "Objection",
  "BookingSent",
  "Booked",
  "Won",
  "Lost",
];

export const SENTIMENT_VALUES: readonly Sentiment[] = ["hot", "warm", "cold"];

/**
 * State blob version. Bump when the JSON shape in the hidden __state column
 * changes incompatibly so the codec can refuse stale rows instead of
 * silently misinterpreting them.
 */
export const STATE_VERSION = 1 as const;
