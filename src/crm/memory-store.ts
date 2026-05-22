import { randomUUID } from "node:crypto";
import type { Lead, LeadCapture, Message } from "../domain/types.js";
import type { LeadStore } from "./types.js";

/**
 * In-memory lead store for development, the simulator, and tests.
 * Keyed by lowercased IG handle so lookups are case-insensitive.
 */
export class MemoryLeadStore implements LeadStore {
  private readonly byHandle = new Map<string, Lead>();

  async upsertCapture(capture: LeadCapture): Promise<Lead> {
    const key = capture.igHandle.toLowerCase();
    const existing = this.byHandle.get(key);
    if (existing) return existing;

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
    this.byHandle.set(key, lead);
    return lead;
  }

  async getByHandle(igHandle: string): Promise<Lead | undefined> {
    return this.byHandle.get(igHandle.toLowerCase());
  }

  async append(igHandle: string, message: Message): Promise<Lead> {
    const lead = this.requireLead(igHandle);
    lead.transcript.push(message);
    lead.lastMessageAt = message.at;
    return lead;
  }

  async update(lead: Lead): Promise<Lead> {
    this.byHandle.set(lead.igHandle.toLowerCase(), lead);
    return lead;
  }

  async staleLeads(before: Date): Promise<Lead[]> {
    const cutoff = before.getTime();
    const active = new Set(["New", "Engaged", "Qualifying", "Objection", "BookingSent"]);
    return [...this.byHandle.values()].filter(
      (l) => active.has(l.stage) && new Date(l.lastMessageAt).getTime() < cutoff,
    );
  }

  private requireLead(igHandle: string): Lead {
    const lead = this.byHandle.get(igHandle.toLowerCase());
    if (!lead) throw new Error(`No lead for handle: ${igHandle}`);
    return lead;
  }
}
