import { describe, it, expect, beforeEach } from "vitest";
import { SheetsLeadStore } from "../src/crm/sheets-store.js";
import type { BatchValueUpdate, CellValue, SheetsClient } from "../src/crm/sheets/client.js";
import { LEADS_COLUMNS } from "../src/crm/sheets/schema.js";

/**
 * In-memory fake of the SheetsClient that covers only the surface the store
 * uses (getValues + batchUpdateValues). Lets us drive the store through its
 * full contract — same shape as the MemoryLeadStore tests — without a
 * network round-trip.
 */
class FakeSheetsClient {
  /** 0-indexed rows; sparse so we can simulate row 5 with no row 4. */
  rows: Map<number, CellValue[]> = new Map();
  /** Recorded calls — useful for ordering / atomicity assertions. */
  calls: Array<{ method: string; payload: unknown }> = [];

  async getValues(_id: string, range: string): Promise<CellValue[][]> {
    this.calls.push({ method: "getValues", payload: range });
    // We only have to handle the two ranges the store actually uses:
    //   "Leads!A2:M"      → full data range from row 2 down
    //   "Leads!A{n}:M{n}" → one row
    const match = range.match(/Leads!A(\d+):[A-Z]+(\d+)?/);
    if (!match) return [];
    const start = parseInt(match[1]!, 10);
    const end = match[2] ? parseInt(match[2], 10) : Math.max(...this.rows.keys(), start);
    const out: CellValue[][] = [];
    for (let r = start; r <= end; r++) {
      const row = this.rows.get(r);
      out.push(row ?? []);
    }
    // Trim trailing blank rows (Sheets does this too).
    while (out.length > 0 && (!out.at(-1) || out.at(-1)!.length === 0)) out.pop();
    return out;
  }

  async batchUpdateValues(_id: string, update: BatchValueUpdate): Promise<void> {
    this.calls.push({ method: "batchUpdateValues", payload: update });
    if (update.valueInputOption !== "RAW") {
      throw new Error(`fake: expected RAW input option, got ${update.valueInputOption}`);
    }
    for (const entry of update.data) {
      const m = entry.range?.match(/Leads!A(\d+):[A-Z]+\d+/);
      if (!m) continue;
      const startRow = parseInt(m[1]!, 10);
      (entry.values ?? []).forEach((row, i) => {
        this.rows.set(startRow + i, row);
      });
    }
  }
}

function makeStore() {
  const fake = new FakeSheetsClient();
  const store = new SheetsLeadStore({
    spreadsheetId: "sheet-id",
    serviceAccountSource: "<unused — client is injected>",
    client: fake as unknown as SheetsClient,
    indexTtlMs: 0, // force re-read every call to exercise the load path
  });
  return { store, fake };
}

describe("SheetsLeadStore", () => {
  let store: SheetsLeadStore;
  let fake: FakeSheetsClient;

  beforeEach(() => {
    ({ store, fake } = makeStore());
  });

  it("upsertCapture is idempotent by handle and writes a row", async () => {
    const a = await store.upsertCapture({ igHandle: "alex.codes", sourceContent: "FIT" });
    const b = await store.upsertCapture({ igHandle: "alex.codes", sourceContent: "OTHER" });
    expect(a.id).toBe(b.id);
    // Only one row should exist in the fake sheet.
    expect(fake.rows.size).toBe(1);
  });

  it("getByHandle is case-insensitive", async () => {
    await store.upsertCapture({ igHandle: "Alex.Codes" });
    const found = await store.getByHandle("alex.codes");
    expect(found).toBeDefined();
    expect(found!.igHandle).toBe("Alex.Codes");
  });

  it("append persists a new message and bumps lastMessageAt", async () => {
    await store.upsertCapture({ igHandle: "lead1" });
    const updated = await store.append("lead1", {
      role: "lead",
      text: "hey",
      at: "2026-05-25T11:00:00.000Z",
    });
    expect(updated.transcript).toHaveLength(1);
    expect(updated.lastMessageAt).toBe("2026-05-25T11:00:00.000Z");
  });

  it("staleLeads returns active leads older than the cutoff", async () => {
    const old = await store.upsertCapture({ igHandle: "old.one" });
    old.lastMessageAt = "2026-05-20T00:00:00.000Z";
    await store.update(old);

    const recent = await store.upsertCapture({ igHandle: "recent.one" });
    recent.lastMessageAt = new Date().toISOString();
    await store.update(recent);

    const stale = await store.staleLeads(new Date("2026-05-22T00:00:00.000Z"));
    expect(stale.map((l) => l.igHandle)).toEqual(["old.one"]);
  });

  it("all() reflects every persisted lead", async () => {
    await store.upsertCapture({ igHandle: "a" });
    await store.upsertCapture({ igHandle: "b" });
    await store.upsertCapture({ igHandle: "c" });
    const all = await store.all();
    expect(all.map((l) => l.igHandle).sort()).toEqual(["a", "b", "c"]);
  });

  it("writes use valueInputOption=RAW (formula-injection safety)", async () => {
    await store.upsertCapture({ igHandle: "weird=user" });
    const write = fake.calls.find((c) => c.method === "batchUpdateValues");
    expect(write).toBeDefined();
    expect((write!.payload as BatchValueUpdate).valueInputOption).toBe("RAW");
  });

  it("never returns its internal Lead references (callers can't mutate cache)", async () => {
    await store.upsertCapture({ igHandle: "lead1" });
    const a = await store.getByHandle("lead1");
    a!.stage = "Won";
    const b = await store.getByHandle("lead1");
    expect(b!.stage).toBe("New"); // mutation didn't leak
  });

  it("encodes exactly one row per write, matching the column count", async () => {
    await store.upsertCapture({ igHandle: "lead1" });
    const write = fake.calls.find((c) => c.method === "batchUpdateValues")!;
    const update = write.payload as BatchValueUpdate;
    const row = update.data[0]!.values![0]!;
    expect(row).toHaveLength(LEADS_COLUMNS.length);
  });
});
