# CLAUDE.md — working guide for this repo

Context for AI assistants (and humans) working on **DM-to-Deal**. Read this first.

## What this is

An autonomous AI sales agent for Instagram influencers. It captures warm leads
(people who comment a keyword), converses in the influencer's exact voice,
books a 1-on-1 call, and tracks the pipeline. Full product spec: [`PRD.md`](./PRD.md).

## Architecture in one breath

**Code-first core, pluggable adapters.** The valuable IP — the agent brain,
the personality/voice engine, the compliance guardrails — lives in real TypeScript.
Messaging (Instagram), storage (CRM), and booking are behind interfaces, so the
provider can be swapped without touching the core.

```
inbound webhook ─▶ Channel.verifyAndParse (UNTRUSTED input boundary)
                      │
                      ▼
                 Orchestrator ──▶ AgentBrain (Claude, structured output + caching)
                      │                 └─ system prompt = cached personality profile
                      ├─▶ Pacer (compliance: human delays + daily cap)
                      ├─▶ LeadStore (CRM memory)
                      └─▶ Channel.send (outbound DM)
```

| Layer | Path | Notes |
|---|---|---|
| Domain types | `src/domain/types.ts` | Shared vocabulary. No impl deps. |
| Agent brain | `src/agent/brain.ts` | One Claude call/turn → validated `AgentDecision`. |
| Prompt builder | `src/agent/prompt.ts` | Builds the **stable, cacheable** system prompt. |
| Decision schema | `src/agent/decision.schema.ts` | zod + JSON Schema, kept in sync. |
| Personality | `src/personality/profile.ts` | The "moat" — per-influencer voice. |
| Channels | `src/channels/*` | `mock`, `manychat`. Inbound = untrusted. |
| CRM | `src/crm/*` | `memory` (now), `sheets` (skeleton). |
| Compliance | `src/compliance/pacing.ts` | Instagram-safe pacing. |
| Orchestrator | `src/orchestrator.ts` | Ties it together; owns policy glue. |
| Server | `src/server/app.ts` | Hardened webhook server. |

## Frontend (`web/`)

A separate Next.js (App Router) + Tailwind app — marketing landing page +
operator dashboard (pipeline, conversation viewer, metrics, personality, live
simulator). It talks to the backend over HTTP via `NEXT_PUBLIC_API_URL`. Design
system is "Signal" (near-black + acid-lime `#C6F24E`, Space Grotesk + JetBrains
Mono) in `web/tailwind.config.ts`. The browser never holds the API key — the
simulator calls the backend, which calls Claude (or the scripted demo brain).
Run with `cd web && npm run dev` (port 3001) alongside the backend (port 3000).

## Conventions

- **ESM + strict TypeScript.** Imports use `.js` extensions (NodeNext-style).
- **Validate at every boundary** with zod. Never trust webhook input.
- **Caching discipline:** the system prompt must be byte-stable per influencer.
  Never interpolate timestamps / per-lead data into it — that busts the prompt
  cache. Volatile context goes in the `messages` array (see `brain.ts`).
- **The agent never emits the booking URL itself.** The orchestrator appends the
  verified Calendly link. This prevents a prompt-injected URL from being sent.
- **Model:** `claude-opus-4-7` via `output_config.format` (structured outputs).
  Effort/thinking are configurable in `src/config/env.ts`.

## Commands

```bash
npm run dev         # watch-run the server (tsx)
npm run typecheck   # tsc --noEmit
npm test            # vitest (no API key needed — brain is stubbed)
npm run lint        # eslint
npm run build       # tsup → dist/
npm run simulate    # live end-to-end demo (needs ANTHROPIC_API_KEY)
```

## Working permissions (for AI assistants)

You have permission to **read, edit, and create files without asking**.
Only ask for confirmation before:

- deleting files,
- running database migrations, or
- making git commits.

## Before committing

Run `npm run typecheck && npm test && npm run lint`. CI enforces all three.

## Security

This handles real users' DMs. See [`SECURITY.md`](./SECURITY.md) and the threat
model before changing the webhook path, the channel adapters, or anything that
touches secrets. Never log tokens or full request bodies.

## Roadmap / what's stubbed

`SheetsLeadStore` and the live Meta Graph API channel are intentionally
skeletons — see [`docs/ROADMAP.md`](./docs/ROADMAP.md). The interfaces are final;
completing them needs no core changes.
