import type { Lead, LeadCapture, Message } from "../domain/types.js";
import type { LeadStore } from "./types.js";

/**
 * Google Sheets-backed store (PRD §7 — the V1 dashboard *is* the database).
 *
 * This is a typed skeleton with the integration seams in place. Wiring it to
 * the live Sheets API is a Phase-1 task (see docs/ROADMAP.md); the interface
 * is identical to MemoryLeadStore, so the agent core needs zero changes when
 * this is completed.
 *
 * SECURITY NOTE: credentials come from a service-account JSON path in env and
 * must never be committed. The Sheets client should be created with the
 * narrowest scope possible (spreadsheets, single sheet).
 */
export interface SheetsConfig {
  spreadsheetId: string;
  serviceAccountJsonPath: string;
}

export class SheetsLeadStore implements LeadStore {
  /** Public so a future Sheets-API implementation can read it; validated here. */
  constructor(readonly config: SheetsConfig) {
    if (!config.spreadsheetId) throw new Error("Sheets: spreadsheetId is required");
    if (!config.serviceAccountJsonPath) {
      throw new Error("Sheets: serviceAccountJsonPath is required");
    }
  }

  private notImplemented(): never {
    throw new Error(
      "SheetsLeadStore is not yet wired up. Use DM_STORE=memory for now, " +
        "or implement against the Google Sheets API (see docs/ROADMAP.md).",
    );
  }

  async upsertCapture(_capture: LeadCapture): Promise<Lead> {
    return this.notImplemented();
  }
  async getByHandle(_igHandle: string): Promise<Lead | undefined> {
    return this.notImplemented();
  }
  async append(_igHandle: string, _message: Message): Promise<Lead> {
    return this.notImplemented();
  }
  async update(_lead: Lead): Promise<Lead> {
    return this.notImplemented();
  }
  async staleLeads(_before: Date): Promise<Lead[]> {
    return this.notImplemented();
  }
  async all(): Promise<Lead[]> {
    return this.notImplemented();
  }
}
