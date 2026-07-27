# Roadmap

Tracks what's built, what's stubbed, and what's next. Mirrors PRD §10 (Build
Roadmap) but at the engineering level.

## ✅ Done — the agent core (this repo, v0.1)

- Domain model + pluggable `Channel` / `LeadStore` / `BookingProvider` interfaces
- `AgentBrain`: Claude `claude-opus-4-7`, structured outputs, prompt caching
- Personality engine (system-prompt builder from a `PersonalityProfile`)
- Orchestrator: full turn loop (open / reply / nudge), booking-link injection,
  STOP/compliance handling, stage transitions
- Compliance `Pacer`: daily send cap + human-like delays
- Hardened webhook server (HMAC verify, zod validation, rate limit, body cap)
- `MockChannel` + `MemoryLeadStore` + live conversation simulator
- Read/simulate HTTP API (metrics, leads, transcripts, profile, simulator)
- Full-stack web app (`web/`): Next.js marketing landing page + operator
  dashboard (pipeline board, conversation viewer, metrics, personality, live
  in-browser simulator) in the "Signal" design system
- Scripted demo brain so the simulator is safe + free to deploy publicly
- Test suite (pacing, signature verification, orchestrator) + CI (backend + web)

## 🔜 Phase 1 — go live on one account (PRD weeks 1–2)

- [x] Implement `SheetsLeadStore` against the Google Sheets API
      (least-privilege service account, single spreadsheet) — see [`SHEETS_SETUP.md`](./SHEETS_SETUP.md)
- [x] Premium spreadsheet provisioning (`npm run sheets:init`) — branded Dashboard, validation, conditional formatting
- [ ] Finish the ManyChat send payload against a real ManyChat flow + verify the
      exact inbound webhook shape; adjust `InboundSchema` to match
- [x] Per-influencer profile loading via `DM_PROFILE_PATH` (see `profiles/example.json`)
- [x] Scheduled "nudge" job: scans `staleLeads()` and sends one soft follow-up per
      lead (at-most-once via `nudgedAt`). Gated behind `DM_NUDGE_ENABLED=true`.
- [x] Deployed on Railway with env-based secrets (demo dashboard + backend live)

## 🔭 Phase 2 — prove + harden (PRD weeks 3–4)

- [ ] Conversation analytics: capture rate, reply rate, booking rate (PRD §11)
- [ ] Move rate-limit + daily-cap state to Redis (multi-instance safe)
- [ ] Dependency + secret scanning in CI (npm audit / Dependabot / gitleaks)
- [ ] Structured eval harness for reply quality + objection handling

## 🚀 Phase 3 — productize + scale (PRD month 2+)

- [ ] Direct Meta Graph API channel (cut ManyChat cost at scale)
- [ ] Multi-tenant: one deployment, many influencers, isolated profiles + creds
- [ ] Self-serve onboarding questionnaire → `PersonalityProfile`
- [ ] Airtable/Postgres CRM for thousands of concurrent leads
- [ ] Payment tracking (Stripe) for automatic revenue attribution
