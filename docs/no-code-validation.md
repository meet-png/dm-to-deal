# No-code validation path

The PRD's original V1 (PRD §5) wires the same agent logic with **no-code tools**
to validate on a live audience fast. This repo's engineered core is the
productized version, but the no-code path is still the quickest way to a first
booked call. The two are complementary: the brain logic is identical; only the
plumbing differs.

| Layer | No-code (validation) | This repo (product) |
|---|---|---|
| Trigger / DMs | ManyChat flow | `ManyChatChannel` adapter |
| Orchestration | Make.com scenario | `Orchestrator` |
| Brain | Claude via Make HTTP module | `AgentBrain` (typed, tested) |
| Memory / CRM | Google Sheets | `LeadStore` (`memory` → `sheets`) |
| Booking | Calendly | `BookingProvider` |

## Fastest validation loop (no deploy)

1. Get an Anthropic API key.
2. `cp .env.example .env` and set `ANTHROPIC_API_KEY`.
3. `npm install && npm run simulate` — watch a full conversation run through the
   real brain with a scripted lead. This validates voice, framework, and booking
   behavior before you touch ManyChat at all.

## Bridging to live

When the simulated conversations feel right, point a ManyChat flow's webhook at
`POST /webhooks/inbound` with `DM_CHANNEL=manychat`, and the same brain handles
real DMs. See [ROADMAP.md](./ROADMAP.md) Phase 1 for the remaining wiring.
