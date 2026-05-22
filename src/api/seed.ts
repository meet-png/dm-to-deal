import type { Lead } from "../domain/types.js";
import type { LeadStore } from "../crm/types.js";

/**
 * Seeds a handful of realistic leads across the pipeline so the dashboard is
 * populated for demos and screenshots. Only used in dev/demo (DM_SEED_DEMO).
 */
const DEMO_LEADS: Array<Partial<Lead> & { igHandle: string }> = [
  { igHandle: "maria.lifts", name: "Maria", sourceContent: "FIT reel", stage: "Won", sentiment: "hot", revenue: 1200 },
  { igHandle: "deskbound_dan", name: "Dan", sourceContent: "FIT reel", stage: "Booked", sentiment: "hot" },
  { igHandle: "fitmom_jess", name: "Jess", sourceContent: "Story poll", stage: "BookingSent", sentiment: "hot" },
  { igHandle: "tiredtom", name: "Tom", sourceContent: "FIT reel", stage: "Qualifying", sentiment: "warm" },
  { igHandle: "newbie_nina", name: "Nina", sourceContent: "Comment START", stage: "Objection", sentiment: "warm" },
  { igHandle: "lurker_lee", sourceContent: "FIT reel", stage: "Engaged", sentiment: "warm" },
  { igHandle: "ghost_gabe", sourceContent: "Story poll", stage: "Lost", sentiment: "cold" },
];

const SAMPLE_TRANSCRIPT = [
  { role: "agent" as const, text: "Hey! Just sent the free reset plan 🙌 What made you grab it?" },
  { role: "lead" as const, text: "honestly I sit at a desk all day and feel awful" },
  { role: "agent" as const, text: "So common — and so fixable. Is it more about time or knowing what to do?" },
];

export async function seedDemoLeads(store: LeadStore): Promise<void> {
  const base = Date.now();
  let i = 0;
  for (const d of DEMO_LEADS) {
    const lead = await store.upsertCapture({
      igHandle: d.igHandle,
      name: d.name,
      sourceContent: d.sourceContent,
    });
    lead.stage = d.stage ?? "New";
    lead.sentiment = d.sentiment ?? "warm";
    if (d.revenue) lead.revenue = d.revenue;
    // Give engaged-or-further leads a short sample transcript.
    if (lead.stage !== "New" && lead.stage !== "Engaged") {
      const at = new Date(base - (DEMO_LEADS.length - i) * 3_600_000).toISOString();
      lead.transcript = SAMPLE_TRANSCRIPT.map((m) => ({ ...m, at }));
      lead.lastMessageAt = at;
    }
    await store.update(lead);
    i += 1;
  }
}
