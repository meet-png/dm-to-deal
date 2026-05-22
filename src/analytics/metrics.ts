import type { Lead, Stage } from "../domain/types.js";

/** Funnel + revenue snapshot for the dashboard (PRD §7.3, §11). */
export interface Metrics {
  totalLeads: number;
  byStage: Record<Stage, number>;
  /** % of leads the agent replied to (engaged or further). */
  replyRate: number;
  /** % of leads that reached BookingSent/Booked/Won. */
  bookingRate: number;
  /** % of booked leads that were Won. */
  winRate: number;
  totalRevenue: number;
  revenuePerLead: number;
}

const ENGAGED_OR_BEYOND: Stage[] = [
  "Engaged",
  "Qualifying",
  "Objection",
  "BookingSent",
  "Booked",
  "Won",
  "Lost",
];
const BOOKED_OR_BEYOND: Stage[] = ["BookingSent", "Booked", "Won"];

/** Pure function — compute metrics from a snapshot of leads. */
export function computeMetrics(leads: Lead[]): Metrics {
  const byStage = emptyStageCounts();
  let totalRevenue = 0;

  for (const lead of leads) {
    byStage[lead.stage] += 1;
    if (lead.stage === "Won") totalRevenue += lead.revenue ?? 0;
  }

  const total = leads.length;
  const engaged = countStages(byStage, ENGAGED_OR_BEYOND);
  const booked = countStages(byStage, BOOKED_OR_BEYOND);
  const won = byStage.Won;

  return {
    totalLeads: total,
    byStage,
    replyRate: pct(engaged, total),
    bookingRate: pct(booked, total),
    winRate: pct(won, booked),
    totalRevenue,
    revenuePerLead: total === 0 ? 0 : round(totalRevenue / total),
  };
}

function emptyStageCounts(): Record<Stage, number> {
  return {
    New: 0,
    Engaged: 0,
    Qualifying: 0,
    Objection: 0,
    BookingSent: 0,
    Booked: 0,
    Won: 0,
    Lost: 0,
  };
}

function countStages(counts: Record<Stage, number>, stages: Stage[]): number {
  return stages.reduce((sum, s) => sum + counts[s], 0);
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : round((part / whole) * 100);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
