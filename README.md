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

## Quickstart

```bash
git clone https://github.com/meet-png/dm-to-deal.git
cd dm-to-deal
npm install
cp .env.example .env          # add your ANTHROPIC_API_KEY

npm run simulate              # watch a full conversation end-to-end (live brain)
```

`npm run simulate` runs a complete lead conversation through the real Claude
brain with a mock channel and in-memory store — no Instagram/ManyChat/Sheets
account required. It's the fastest way to see the agent's voice and booking flow.

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
- 🤖 [`CLAUDE.md`](./CLAUDE.md) — guide for working in this repo

## Tech

TypeScript (strict, ESM) · [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)
(Claude Opus 4.7, structured outputs, prompt caching) · Express · Zod · Vitest.
Deliberately small dependency surface to minimize supply-chain risk.

## Status

`v0.1` — the agent core is complete, tested, and CI-green. Going live on a real
account (Google Sheets + ManyChat wiring) is Phase 1 on the [roadmap](./docs/ROADMAP.md).

## License

[MIT](./LICENSE) © Meet Kabra
