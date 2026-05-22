# Architecture

DM-to-Deal is a **code-first agent core with pluggable adapters**. This document
explains the *why* behind that shape and how a single message flows through it.

## Design principle: own the moat, rent the plumbing

The defensible, valuable parts of this product are the **reasoning loop**, the
**personality/voice engine**, and the **compliance guardrails**. Those are real,
tested TypeScript that you own and could license or sell.

The commodity parts — receiving/sending DMs, storing rows, generating a booking
link — sit behind interfaces (`Channel`, `LeadStore`, `BookingProvider`). The
core never imports a concrete provider, so:

- V1 ships on **ManyChat** (Meta-approved, compliant). Later, swap to the direct
  Meta Graph API by writing one new `Channel` — zero core changes.
- Tests and the local simulator use a `MockChannel` + `MemoryLeadStore`, so the
  whole system runs with no external accounts.

## The single-message data flow

This mirrors PRD §5.2, in code:

1. **Inbound webhook** hits `POST /webhooks/inbound` (`server/app.ts`).
2. The active **`Channel.verifyAndParse`** verifies the HMAC signature over the
   raw bytes and validates the body with zod. Untrusted input never gets past here
   unverified. → normalized `InboundEvent`.
3. The server **acknowledges `202`** immediately and processes asynchronously.
4. The **`Orchestrator`** loads/creates the `Lead` from the `LeadStore`, appends
   the inbound message to the transcript.
5. It calls the **`AgentBrain`**, which makes one Claude request:
   - `system`: the influencer's personality prompt (a **cached** prefix).
   - `messages`: per-lead context + the rendered transcript (volatile suffix).
   - `output_config.format`: forces a structured `AgentDecision`.
6. The brain returns `{ reply, stage, sentiment, action, reasoning }`, validated
   by zod.
7. The orchestrator applies **policy glue**: appends the verified booking link on
   `SEND_BOOKING`, honors `STOP`, updates stage/sentiment.
8. The **`Pacer`** checks the daily cap and waits a human-like delay.
9. **`Channel.send`** delivers the DM; the turn is persisted to the store.

## Why structured outputs + prompt caching

- **Structured outputs** (`output_config.format`) make the agent's behavior a
  fixed schema. The orchestrator never parses free text, and a prompt-injected
  lead can't introduce new control flow — it can only fill the schema. The
  natural-language reply and the machine decision come back in one call.
- **Prompt caching** puts the large, stable personality prompt first, marked
  `cache_control: ephemeral`. Across every turn and every lead for that
  influencer it's served from cache (~0.1× cost), so a full 8–10 message
  conversation costs cents (PRD §9). The cache only works if the prompt is
  byte-stable — hence the rule that nothing volatile goes in the system prompt.

## Module map

See [`CLAUDE.md`](../CLAUDE.md#architecture-in-one-breath) for the table of
modules and responsibilities.

## Extending the system

| Want to… | Do this |
|---|---|
| Support the direct Meta Graph API | Implement `WebhookChannel` in `src/channels/` |
| Persist to a real DB | Implement `LeadStore` (Postgres/Airtable) |
| Onboard a new influencer | Build a `PersonalityProfile`; load per account |
| Add real Calendly availability | Implement `BookingProvider` against the API |
| Run multi-instance | Move the rate limiter + daily cap to Redis |
