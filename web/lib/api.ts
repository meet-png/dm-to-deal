import type { LeadDetail, LeadSummary, Metrics, Profile, SimTurn } from "./types";

/**
 * Thin typed client for the DM-to-Deal backend. Base URL is configurable so
 * the dashboard can point at a deployed API; defaults to local dev.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  metrics: () => get<Metrics>("/api/metrics"),
  leads: () => get<LeadSummary[]>("/api/leads"),
  lead: (handle: string) => get<LeadDetail>(`/api/leads/${encodeURIComponent(handle)}`),
  profile: () => get<Profile>("/api/profile"),
  simulateStart: (opts: { persist?: boolean } = {}) =>
    post<SimTurn>("/api/simulate/start", opts),
  simulateMessage: (sessionId: string, text: string) =>
    post<SimTurn>("/api/simulate/message", { sessionId, text }),
};

export { BASE as API_BASE };
