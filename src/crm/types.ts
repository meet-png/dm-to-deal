import type { Lead, LeadCapture, Message } from "../domain/types.js";

/**
 * Persistence boundary for leads + transcripts (PRD §7, the Google Sheets
 * "memory"). Abstracted so the agent core is storage-agnostic: in-memory for
 * dev/tests, Google Sheets for V1, Postgres/Airtable later — all the same API.
 */
export interface LeadStore {
  /** Create a lead from a fresh opt-in, or return the existing one (idempotent). */
  upsertCapture(capture: LeadCapture): Promise<Lead>;
  getByHandle(igHandle: string): Promise<Lead | undefined>;
  append(igHandle: string, message: Message): Promise<Lead>;
  /** Persist mutated fields (stage, sentiment, bookingLinkSentAt, …). */
  update(lead: Lead): Promise<Lead>;
  /** Leads with no activity since `before`, used to drive nudges. */
  staleLeads(before: Date): Promise<Lead[]>;
  /** A snapshot of every lead — used for the dashboard metrics + pipeline. */
  all(): Promise<Lead[]>;
}
