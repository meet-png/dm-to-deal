import { describe, it, expect } from "vitest";
import type { Lead } from "../src/domain/types.js";
import {
  decodeRow,
  encodeRow,
  isoToSerial,
  serialToIso,
} from "../src/crm/sheets/codec.js";
import { LEADS_COLUMNS, colIndex } from "../src/crm/sheets/schema.js";

function sampleLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    igHandle: "alex.codes",
    name: "Alex",
    sourceContent: "FIT",
    stage: "Engaged",
    sentiment: "warm",
    transcript: [
      { role: "agent", text: "hey!", at: "2026-05-25T10:00:00.000Z" },
      { role: "lead", text: "yo whatsup", at: "2026-05-25T10:01:30.000Z" },
    ],
    firstContactAt: "2026-05-25T10:00:00.000Z",
    lastMessageAt: "2026-05-25T10:01:30.000Z",
    ...overrides,
  };
}

describe("sheets codec", () => {
  it("round-trips a fully-populated lead", () => {
    const lead = sampleLead({ bookingLinkSentAt: "2026-05-25T10:05:00.000Z", revenue: 1500 });
    const row = encodeRow(lead);
    const decoded = decodeRow(row);

    expect(decoded.id).toBe(lead.id);
    expect(decoded.igHandle).toBe(lead.igHandle);
    expect(decoded.name).toBe(lead.name);
    expect(decoded.sourceContent).toBe(lead.sourceContent);
    expect(decoded.stage).toBe(lead.stage);
    expect(decoded.sentiment).toBe(lead.sentiment);
    expect(decoded.transcript).toEqual(lead.transcript);
    expect(decoded.firstContactAt).toBe(lead.firstContactAt);
    expect(decoded.lastMessageAt).toBe(lead.lastMessageAt);
    expect(decoded.bookingLinkSentAt).toBe(lead.bookingLinkSentAt);
    expect(decoded.revenue).toBe(lead.revenue);
  });

  it("round-trips a minimal lead with no optional fields", () => {
    const lead = sampleLead({
      name: undefined,
      sourceContent: undefined,
      transcript: [],
    });
    const decoded = decodeRow(encodeRow(lead));
    expect(decoded.name).toBeUndefined();
    expect(decoded.sourceContent).toBeUndefined();
    expect(decoded.bookingLinkSentAt).toBeUndefined();
    expect(decoded.revenue).toBeUndefined();
    expect(decoded.transcript).toEqual([]);
  });

  it("defangs strings that start with formula-trigger chars", () => {
    // Sheets treats any cell whose value starts with =, +, -, or @ as a
    // formula under USER_ENTERED. Our codec prepends a literal "'" so even if
    // the sheet is flipped to USER_ENTERED via the UI, lead-controlled input
    // can't execute. We write with RAW which is already safe, this is belt-
    // and-braces.
    const inputs = ["=HYPERLINK(\"evil\")", "+CMD", "-1+1", "@reference", "\tinjected"];
    for (const igHandle of inputs) {
      const row = encodeRow(sampleLead({ igHandle }));
      const cell = row[colIndex("igHandle")];
      expect(typeof cell).toBe("string");
      expect((cell as string).startsWith("'")).toBe(true);
    }
  });

  it("leaves harmless strings untouched (no leading apostrophe)", () => {
    const row = encodeRow(sampleLead({ igHandle: "alex.codes" }));
    expect(row[colIndex("igHandle")]).toBe("alex.codes");
  });

  it("encodes timestamps as Sheets serial numbers (not ISO strings)", () => {
    const row = encodeRow(sampleLead());
    const firstContactCell = row[colIndex("firstContact")];
    expect(typeof firstContactCell).toBe("number");
    // 2026-05-25 ≈ serial ~46_180
    expect(firstContactCell as number).toBeGreaterThan(40_000);
    expect(firstContactCell as number).toBeLessThan(60_000);
  });

  it("isoToSerial / serialToIso are exact inverses on integer-day boundaries", () => {
    const iso = "2026-01-01T00:00:00.000Z";
    expect(serialToIso(isoToSerial(iso))).toBe(iso);
  });

  it("truncates transcript history to fit a Sheets cell", () => {
    // 5000 short messages → serialised JSON would exceed the 50KB cell cap
    // without truncation. The codec keeps only the most recent slice.
    const base = Date.UTC(2026, 4, 25, 10);
    const huge: Lead = sampleLead({
      transcript: Array.from({ length: 5000 }, (_, i) => ({
        role: "lead" as const,
        text: `msg ${i}`, // unique payload to verify *which* messages survived
        at: new Date(base + i * 1000).toISOString(),
      })),
    });
    const row = encodeRow(huge);
    const stateCell = row[colIndex("state")];
    expect(typeof stateCell).toBe("string");
    expect((stateCell as string).length).toBeLessThan(50_000);
    const decoded = decodeRow(row);
    expect(decoded.transcript.length).toBeLessThanOrEqual(200);
    // Keeps the *most recent* slice — the kept window is at the tail end of
    // the input, never the head.
    expect(decoded.transcript[0]!.text).not.toBe("msg 0");
    expect(decoded.transcript.at(-1)!.text).toBe("msg 4999");
  });

  it("falls back gracefully on a malformed state blob", () => {
    const row = encodeRow(sampleLead());
    row[colIndex("state")] = "not-json-at-all";
    const decoded = decodeRow(row);
    expect(decoded.transcript).toEqual([]);
    // Other fields still decode from the visible columns.
    expect(decoded.igHandle).toBe("alex.codes");
    expect(decoded.stage).toBe("Engaged");
  });

  it("encodes one cell per declared column (row width matches schema)", () => {
    const row = encodeRow(sampleLead());
    expect(row).toHaveLength(LEADS_COLUMNS.length);
  });
});
