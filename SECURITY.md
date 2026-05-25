# Security Policy & Threat Model

DM-to-Deal processes real users' Instagram messages and holds API credentials
for an influencer's account. Security is a first-class design constraint, not an
afterthought. This document describes the threat model, the controls in place,
and how to report a vulnerability.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Email the maintainer
privately with details and reproduction steps. You'll get an acknowledgement
within 72 hours.

## Trust boundaries

```
[ Internet ] ──webhook──▶ [ HTTP server ] ──▶ [ Orchestrator/Brain ] ──▶ [ Claude API ]
   UNTRUSTED                 semi-trusted            trusted core
                                  │
                                  └──▶ [ ManyChat / Sheets / Calendly ] (3rd-party, authenticated)
```

The **only** untrusted entry point is the inbound webhook. Everything dangerous
happens there, and that is exactly where the controls are concentrated.

## Controls in place

### 1. Webhook authenticity — HMAC, constant-time
`src/channels/manychat.ts` requires an `x-manychat-signature: sha256=<hex>`
header. The signature is recomputed over the **raw request bytes** with the
shared secret and compared using `crypto.timingSafeEqual` (constant-time, so it
leaks no information via timing). Missing/malformed/mismatched → `401`, never a
`200`. This blocks request forgery and replay-with-tampering.

### 2. Strict input validation
Every webhook body is parsed with a zod schema (`InboundSchema`) **before** any
business logic runs. The IG handle is constrained to `^[A-Za-z0-9._]+$` (blocks
path-traversal / injection-style handles), text is length-capped, and unknown
event types are rejected. Config is likewise validated at boot (`config/env.ts`)
so the service fails fast rather than running half-configured.

### 3. Denial-of-service hardening
- Request body capped at **64 KB** (`express.text({ limit })`).
- Per-IP fixed-window **rate limit** on the webhook route (120 req/min).
- The webhook acknowledges with `202` and processes asynchronously, so a slow
  downstream can't tie up the connection.

### 4. Prompt-injection containment
A lead's messages reach the LLM, so prompt injection is assumed. Mitigations:
- The agent's **decision is structured** (`output_config.format`) — it can't
  invent new control flow, only fill a fixed schema.
- The **booking URL is never produced by the model.** The orchestrator appends
  the verified Calendly link itself, so an injected "click here" URL is never
  sent to the lead.
- The agent has **no tools** that can take real-world actions. Its only output
  is text + an enum decision; the trusted orchestrator decides what to do.
- A `STOP` action is honored as a hard compliance stop.

### 5. Secret handling
- Secrets come only from environment variables (`config/env.ts`); none are
  hardcoded. `.env`, `*.pem`, `service-account*.json`, etc. are git-ignored.
- Logs are structured and **redacted** — tokens and full third-party response
  bodies are never logged (`server/app.ts`, `manychat.ts`).
- Outbound API tokens are sent only over HTTPS to the provider.

### 6. Response hygiene
`x-powered-by` is disabled and hardening headers (`X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store`) are set.
Error responses are minimal (`{"error":"rejected"}`); details stay server-side.

### 7. Account-safety / abuse pacing
`src/compliance/pacing.ts` enforces a per-account daily send cap and randomized
human-like delays. This protects the influencer's account from Meta bans and
also bounds the blast radius of any logic error (the agent can't spray messages).

## Known limitations / hardening backlog

- The in-memory rate limiter and daily cap are per-process; a multi-instance
  deployment needs a shared store (Redis). Tracked in `docs/ROADMAP.md`.
- `SheetsLeadStore` writes with `valueInputOption=RAW` and additionally defangs
  leading `= + - @` characters in user-controlled cells — combined, these block
  formula-injection from a lead's DM. The service-account JWT is scoped to the
  Sheets API only (no Drive). See [`docs/SHEETS_SETUP.md`](./docs/SHEETS_SETUP.md).
- Add dependency scanning (`npm audit` / Dependabot) and secret scanning in CI.

## Dependencies

We keep the dependency surface deliberately small (`@anthropic-ai/sdk`,
`express`, `zod`) to minimize supply-chain risk. Run `npm audit` before releases.
