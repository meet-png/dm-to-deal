# Product Requirements Document — DM-to-Deal

**An Autonomous AI Sales Agent for Instagram Influencers**

> Capture warm leads. Nurture them like a top closer. Book the call. Track the revenue.

**Version 1.0** · Zero-Investment Build · Prepared: May 2026

---

## Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem & The Opportunity](#2-the-problem--the-opportunity)
3. [Target Users](#3-target-users)
4. [How the System Works (End to End)](#4-how-the-system-works-end-to-end)
5. [Technical Architecture](#5-technical-architecture)
6. [The AI Agent — The Brain](#6-the-ai-agent--the-brain)
7. [The Data Model (Google Sheets)](#7-the-data-model-google-sheets)
8. [Account Safety & Compliance](#8-account-safety--compliance)
9. [Cost Breakdown](#9-cost-breakdown)
10. [Build Roadmap](#10-build-roadmap)
11. [Success Metrics](#11-success-metrics)

---

## 1. Executive Summary

DM-to-Deal is a fully autonomous AI sales agent that lives inside an Instagram influencer's account. It captures warm leads the moment they engage with content, opens a natural human conversation in the influencer's exact voice, nurtures the lead, handles objections, and books a 1-on-1 call — all without human involvement. Every lead, conversation, booking, and dollar of revenue is tracked automatically in a clean dashboard.

The core insight: influencers sit on thousands of warm, high-intent followers who are never properly engaged. Nobody is reaching out, qualifying them, and putting them on a call. This system does exactly that, at scale, while staying fully compliant with Instagram's rules.

> **THE ONE-LINE PITCH**
> We turn an influencer's silent audience into booked sales calls — automatically, in their own voice, 24/7.

### 1.1 Goals

- Build a working system at **$0 fixed cost** (only ~$5–10/mo in usage-based AI fees).
- Prove the system on the founder's own audience before selling it.
- Achieve a smooth, friendly experience for both the influencer and the lead.
- Be 100% compliant with Instagram / Meta policy — zero account-ban risk.
- Make the system productizable — easy to clone for each new client later.

### 1.2 Non-Goals (Out of Scope for V1)

- Cold DMing or scraping followers (bannable — explicitly excluded).
- Payment processing integration (Stripe) — revenue is logged manually for now.
- A self-serve onboarding questionnaire — built in a later version.
- A custom mobile app or web dashboard — Google Sheets is the V1 dashboard.

---

## 2. The Problem & The Opportunity

### 2.1 The Problem

Influencers in fitness, finance, and coaching have audiences full of people experiencing a real, painful problem — insecurity about their body, or anxiety about money. These followers are the warmest possible leads. Yet:

- Most followers never message the influencer, assuming they'll be ignored.
- Influencers don't have time to manually DM and nurture hundreds of people.
- When leads do come in, there's no system to qualify them or book calls.
- Revenue leaks everywhere — no tracking, no follow-up, no pipeline.

### 2.2 The Opportunity

A single piece of content with a call-to-action can generate hundreds of warm inbound signals. If each of those is instantly engaged by an AI that talks exactly like the influencer, qualifies the lead, and books a call — the influencer's revenue per post multiplies, with zero added effort.

> **WHY THIS WINS**
> - **Warmer than cold outreach:** every lead has already raised their hand by engaging.
> - **Cheaper than a human setter:** pennies per conversation vs. thousands per month.
> - **Always on:** responds in minutes, any hour, never forgets a follow-up.
> - **Personal at scale:** every lead feels like the influencer personally replied.

---

## 3. Target Users

### 3.1 Primary Customer (Who Buys)

| Segment | Who They Are | Why They Need It |
|---|---|---|
| Influencers | Fitness, finance & coaching creators (5k–500k followers) | Sitting on warm audiences they can't monetize manually |
| Appointment Setters | Freelancers / agencies who book calls for creators | Want to 10x output without hiring more humans |
| The Founder (You) | Running this for your own offer first | Prove results, then sell the system as a service |

### 3.2 The End User in the Conversation (The Lead)

A follower who engaged with a piece of content — they want a result (lose weight, get fit, make money) and are open to help but haven't committed. The system's job is to make them feel seen, build trust, and get them onto a call.

---

## 4. How the System Works (End to End)

The entire system runs as a loop triggered by audience engagement. Here is the full journey from content to closed revenue:

### 4.1 The Lead Journey

- **Hook:** Influencer posts a reel/story with a keyword CTA — e.g. "Comment FIT for my free plan."
- **Capture:** A follower comments the keyword. The system instantly detects it.
- **First DM:** The AI sends a warm, personal opening DM in the influencer's voice, delivering what was promised.
- **Conversation:** As the lead replies, the AI responds naturally — qualifying, building rapport, and handling objections like a top closer.
- **Booking:** Within ~5 messages, the AI positions a free 1-on-1 strategy session and sends a Calendly link.
- **Sync:** Once booked, the meeting auto-adds to the calendar and the lead's status updates everywhere.
- **Follow-up:** If a lead goes quiet, the AI sends one soft nudge after 24 hours, then marks them cold if no reply.
- **Outcome:** After the call, the influencer marks Won/Lost. The dashboard tracks revenue and conversion automatically.

### 4.2 Visual Flow

```
Content + CTA → Follower Comments → Instant DM (AI) → Conversation (AI) →
Booking Link → Call Booked → Calendar + Sheet Updated → Call Happens →
Won / Lost Logged → Revenue Tracked
```

---

## 5. Technical Architecture

The system is built in seven layers, each handled by a best-in-class free tool. The only paid element is the AI itself, billed per use at a few cents per conversation.

### 5.1 The Seven Layers

| Layer | Tool | Role |
|---|---|---|
| 1. Trigger | ManyChat (Free) | Detects comments & sends/receives DMs via Meta's official API |
| 2. Brain | Claude API | Generates every reply in the influencer's voice; decides next step |
| 3. Orchestration | Make.com (Free) | Connects all tools; runs the agent loop on every message |
| 4. Memory / CRM | Google Sheets | Stores every lead, conversation history & current stage |
| 5. Booking | Calendly (Free) | Provides booking link & confirms scheduled calls |
| 6. Tracking | Google Sheets | The live dashboard: pipeline, bookings, outcomes, revenue |
| 7. Personality | Custom prompt | Per-influencer voice profile — the system's secret sauce |

> **WHY THIS STACK**
> - **ManyChat** is a Meta-approved partner — the only safe way to automate Instagram DMs at scale.
> - **Claude** produces the most natural, human conversation of any AI — essential for a believable closer.
> - **Make.com** is visual, fast to build on, and free up to 1,000 operations/month — perfect for validation.
> - **Google Sheets** is where influencers already live — zero learning curve, instant familiarity.

### 5.2 Data Flow on a Single Message

Every time a lead replies, this exact sequence fires automatically:

- ManyChat receives the lead's DM and sends it to Make.com via webhook.
- Make.com looks up the lead's full history & stage from Google Sheets.
- Make.com sends the history + influencer personality profile to the Claude API.
- Claude returns the next reply AND a decision (continue / book / mark cold / stop).
- Make.com sends the reply back through ManyChat to the lead — with a natural delay.
- Make.com updates the lead's stage and logs the message in Google Sheets.
- If Claude decided to book, Make.com inserts the Calendly link into the DM.

---

## 6. The AI Agent — The Brain

This is the heart of the product. The agent is not a scripted chatbot; it reasons about each lead and adapts. Every reply runs through a fixed internal thought process.

### 6.1 The Agent's Thinking Loop

| Step | What the Agent Does |
|---|---|
| 1. READ | Pulls the full conversation history and current stage for this lead |
| 2. ASSESS | Judges the lead's emotional state: interested, cold, objecting, or ready |
| 3. GOAL | Picks the next micro-step: warm up, qualify, handle objection, or push booking |
| 4. RESPOND | Writes a short, natural reply (2–3 lines) in the influencer's exact tone |
| 5. DECIDE | Outputs an action tag: CONTINUE, SEND_BOOKING, NUDGE, or MARK_LOST |
| 6. UPDATE | Logs the message and new stage back to Google Sheets |

### 6.2 The Conversation Framework (Top-Closer Style)

Modeled on elite sales psychology — warm, confident, never pushy, always making the lead feel special. The target is to book within roughly five messages.

| Msg | Purpose | Feel |
|---|---|---|
| 1 | Deliver the promised value + open a loop | Warm, generous, personal |
| 2 | Show genuine curiosity about their situation | Make them feel seen |
| 3 | Light qualification — surface their real pain | Helpful, not interrogating |
| 4 | Position the 1-on-1 as the solution (a free session, not a pitch) | Confident, valuable |
| 5 | Send the booking link | Low-pressure, high-value |

### 6.3 The Personality Layer (The Moat)

Each influencer gets a unique master profile built from two inputs, combined into the AI's system prompt:

- **Questionnaire (later version):** their tone, common phrases, emoji habits, energy, offer, and the objections they hear most.
- **Content analysis:** their last ~30 captions/story texts, fed to the AI to auto-learn their authentic voice.

Combining both produces a voice so accurate the lead believes they're talking to the influencer personally. This personalization is the hardest thing for competitors to copy — and it's your defensible advantage.

---

## 7. The Data Model (Google Sheets)

A premium, fully-organized workbook acts as both the system's memory and the influencer's dashboard. It contains three connected tabs.

### 7.1 Tab 1 — Leads (The CRM)

| Field | Purpose |
|---|---|
| Lead ID | Unique identifier for each lead |
| IG Handle | The lead's Instagram username |
| Name | First name (captured during conversation) |
| Source Content | Which post/keyword brought them in |
| First Contact | Date & time of first DM |
| Stage | New / Engaged / Qualifying / Objection / Booking Sent / Booked / Won / Lost |
| Last Message At | Timestamp of the most recent message |
| Conversation Log | Full running transcript (the AI's memory) |
| Sentiment | AI's read on the lead: hot / warm / cold |
| Next Action | What the system will do next |

### 7.2 Tab 2 — Bookings

| Field | Purpose |
|---|---|
| Lead ID | Links back to the Leads tab |
| IG Handle | The lead's username |
| Call Date & Time | When the session is scheduled |
| Calendly Link | The booking record |
| Status | Scheduled / Completed / No-show / Rescheduled |

### 7.3 Tab 3 — Revenue & Analytics

| Field | Purpose |
|---|---|
| Lead ID | Links back to the Leads tab |
| Outcome | Won / Lost (marked by influencer after the call) |
| Revenue | Amount paid, if won |
| Conversion Rate | Auto-calculated: leads → booked → won |
| Revenue per Lead | Auto-calculated performance metric |

> **DASHBOARD VIEW**
> The top of the workbook shows live totals: total leads, conversations active, calls booked, calls completed, deals won, and total revenue — auto-updating so the influencer sees performance at a glance.

---

## 8. Account Safety & Compliance

This is non-negotiable. The entire system is designed so an influencer's account is never at risk. Instagram bans accounts that scrape or cold-message strangers — we do neither.

| Rule | How We Comply |
|---|---|
| Only message people who engaged | We only DM users who commented or replied first — never cold outreach |
| Use official API only | All messaging runs through ManyChat on Meta's approved API |
| Respect rate limits | Make.com paces messages well under the safe ~50–70/day per account |
| Look human | Randomized 2–8 minute delays between replies; never instant bot speed |
| No repetition | The AI varies every message — no copy-paste templates |
| Isolate risk | One influencer = one connected account, fully separated |

> **THE GOLDEN RULE**
> Never scrape followers. Never cold-DM. Every conversation begins with the lead raising their hand first. This keeps the account safe forever.

---

## 9. Cost Breakdown

### 9.1 V1 — Validation (What You Build Now)

| Tool | Plan | Cost |
|---|---|---|
| ManyChat | Free | $0 |
| Make.com | Free (1,000 ops/mo) | $0 |
| Google Sheets | Free | $0 |
| Calendly | Free | $0 |
| Claude API | Pay-per-use | ~$5–10/mo |
| **TOTAL** | | **~$5–10/mo** |

A full lead conversation of 8–10 messages costs roughly **$0.02–0.05** in AI fees. The economics are extraordinary: you can run hundreds of conversations for a few dollars.

### 9.2 The Business Math

| Metric | Value |
|---|---|
| Your cost per client (at scale) | ~$10–30/mo |
| What you charge per client | $500–1,500/mo |
| Gross margin | ~95%+ |

---

## 10. Build Roadmap

### 10.1 Phase 1 — Validate (Weeks 1–2)

- Set up ManyChat, Make.com, Google Sheets, Calendly (all free).
- Build your own personality profile from your captions.
- Wire the agent loop and test the full conversation flow end-to-end.
- Run it live on your own audience. Get the first booked calls.

### 10.2 Phase 2 — Prove (Weeks 3–4)

- Optimize the conversation framework based on real lead responses.
- Refine objection handling and booking timing.
- Document results: leads captured, calls booked, revenue closed.

### 10.3 Phase 3 — Sell (Month 2+)

- Cold-DM potential clients (influencers / setters) with your proven results.
- On signup, clone the system and build their personality profile.
- Upgrade infrastructure (self-hosted n8n + Meta API direct) to cut cost & scale.
- Build the self-serve onboarding questionnaire.

### 10.4 Future Upgrades (Post-Validation)

| Upgrade | Benefit |
|---|---|
| Self-serve questionnaire | Onboard new clients in minutes, automatically |
| Move to n8n + Meta API | Flat cost at any scale; full control |
| Airtable CRM | Handles thousands of concurrent leads cleanly |
| Payment tracking (Stripe) | Automatic revenue attribution |
| Custom client dashboard | A branded web UI instead of Sheets |

---

## 11. Success Metrics

V1 is successful if it proves the system books real calls reliably and feels human. Track these from day one:

| Metric | What It Tells You | V1 Target |
|---|---|---|
| Capture Rate | % of commenters who get a first DM | 100% |
| Reply Rate | % of leads who respond to the first DM | 40%+ |
| Booking Rate | % of conversations that book a call | 15%+ |
| Show Rate | % of booked calls that actually happen | 60%+ |
| Naturalness | Do leads believe it's the real influencer? | Yes (qualitative) |
| Cost per Booking | Total AI spend ÷ calls booked | < $1 |

> **DEFINITION OF DONE FOR V1**
> The system runs on your own Instagram, captures commenters automatically, holds natural conversations in your voice, books real calls onto your calendar, and tracks every lead and dollar in the dashboard — at near-zero cost, with zero account risk.

---

*Next step: lock the build sequence and start wiring Phase 1.*
