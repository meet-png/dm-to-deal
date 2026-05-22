# DM-to-Deal

> An autonomous AI sales agent for Instagram influencers. It captures warm leads
> the moment they engage, holds a natural conversation **in the influencer's own
> voice**, books a 1-on-1 call, and tracks the pipeline — 24/7, at near-zero cost.

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Node" src="https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white">
  <img alt="Claude" src="https://img.shields.io/badge/Claude-Opus%204.7-D97757">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black">
</p>

It is **secure by design** ([`SECURITY.md`](./SECURITY.md)) and built around a
clean, swappable architecture so the messaging, storage, and booking providers
can change without touching the agent core.

---

## Why it's built this way

The valuable, defensible IP — the **reasoning loop**, the **personality / voice
engine**, and the **compliance guardrails** — is real, tested TypeScript that the
business owns. The commodity plumbing (sending DMs, storing rows, booking links)
sits behind interfaces, so V1 can ship on ManyChat today and swap to the direct
Meta Graph API later with a one-file change.

```
inbound webhook ─▶ Channel.verifyAndParse   (untrusted input: HMAC + schema)
                      │
                      ▼
                 Orchestrator ─▶ AgentBrain  (Claude · structured output · prompt caching)
                      │               └─ system prompt = cached personality profile
                      ├─▶ Pacer       (compliance: human delays + daily cap)
                      ├─▶ LeadStore   (CRM / memory)
                      └─▶ Channel.send (outbound DM)
```

Full design rationale: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Repo layout

```
.            backend: the agent core + webhook server + read/simulate API (TypeScript)
└─ web/      frontend: Next.js marketing site + operator dashboard (Tailwind)
```

The frontend talks to the backend over HTTP. The browser never sees the
Anthropic key — the in-browser simulator calls the backend, which calls Claude
server-side (and falls back to a free, scripted demo brain when no key is set,
so a public deploy is safe).

## Quickstart

```bash
git clone https://github.com/meet-png/dm-to-deal.git
cd dm-to-deal
npm install
cp .env.example .env          # optional: add ANTHROPIC_API_KEY for the real brain

npm run simulate              # watch a full conversation end-to-end in the terminal
```

`npm run simulate` runs a complete lead conversation through the agent with a
mock channel and in-memory store — no Instagram/ManyChat/Sheets account required.

### Run the full stack (dashboard + landing page)

```bash
# terminal 1 — backend API (seeds demo leads, runs in scripted mode w/o a key)
npm run dev                   # http://localhost:3000

# terminal 2 — Next.js site + dashboard
cd web && npm install && npm run dev   # http://localhost:3001
```

Open **http://localhost:3001** for the landing page (with a live in-browser
agent demo) and **/dashboard** for the operator console — pipeline board,
conversation viewer, metrics, personality profile, and the simulator.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Watch-run the webhook server |
| `npm run simulate` | Live end-to-end conversation demo (needs `ANTHROPIC_API_KEY`) |
| `npm test` | Run the test suite (no API key needed — the brain is stubbed) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Bundle to `dist/` |

## How it works (one turn)

1. A webhook arrives → the `Channel` **verifies the HMAC signature** over the raw
   bytes and **validates the body** with zod. Untrusted input stops here if invalid.
2. The `Orchestrator` loads the lead and calls the `AgentBrain`.
3. The brain makes **one Claude call**: a cached personality system prompt +
   the transcript, returning a **structured decision** `{ reply, stage,
   sentiment, action, reasoning }`.
4. The orchestrator applies policy (appends the *verified* booking link on
   `SEND_BOOKING`, honors `STOP`), the `Pacer` waits a human-like delay, and the
   reply is sent and persisted.

## Documentation

- 📄 [`PRD.md`](./PRD.md) — the full product spec
- 🏗️ [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — design & data flow
- 🔐 [`SECURITY.md`](./SECURITY.md) — threat model & controls
- 🗺️ [`docs/ROADMAP.md`](./docs/ROADMAP.md) — what's built / next
- 🧪 [`docs/no-code-validation.md`](./docs/no-code-validation.md) — the fast validation path
- 📣 [`docs/marketing.md`](./docs/marketing.md) — launch copy (X + LinkedIn)
- 🤖 [`CLAUDE.md`](./CLAUDE.md) — guide for working in this repo

## Tech

**Backend:** TypeScript (strict, ESM) · [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)
(Claude Opus 4.7, structured outputs, prompt caching) · Express · Zod · Vitest.
**Frontend:** Next.js (App Router) · React · Tailwind CSS.
Deliberately small dependency surface to minimize supply-chain risk.

## Status

`v0.1` — agent core + read/simulate API + full-stack dashboard are complete,
tested, and CI-green. Going live on a real account (Google Sheets + ManyChat
wiring) is Phase 1 on the [roadmap](./docs/ROADMAP.md).

## License

[MIT](./LICENSE) © Meet Kabra
