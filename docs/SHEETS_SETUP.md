# Google Sheets setup

The Phase 1 store. Five minutes from a blank Google Cloud project to a
live, premium-looking pipeline that the agent reads and writes in real time.

## What you get

Running `npm run sheets:init` provisions a spreadsheet styled to the same
"Signal" design system as the dashboard:

- **Dashboard** tab — branded header, six live KPI tiles (Leads, Active, Booked, Won, Revenue, Win rate) and a stage-by-stage funnel.
- **Leads** tab — frozen header, banded rows, validation dropdowns for Stage and Sentiment, conditional colour for every stage (Won pops in the brand acid-lime), native date formatting, currency on Revenue, hairline column separators.
- **Bookings** + **Revenue** tabs — derived filter views that auto-update from Leads.
- A hidden `__state` column holds the full transcript as JSON so nothing is lost when a human edits a visible cell.

It's idempotent. Run it again any time to heal formatting or pick up new schema.

## Prerequisites

- A Google account.
- ~5 min in the Google Cloud Console.
- Node 20+ and this repo installed.

## 1 — Create a service account (one-time)

1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or pick an existing one). Name it something like `dm-to-deal`.
3. Enable the **Google Sheets API** for the project. Search "Sheets API" in the top bar → **Enable**.
4. Go to **IAM & Admin → Service accounts → Create service account**.
   - Name: `dm-to-deal-sheets`
   - Skip the optional role grants — we don't want this account to have any project-wide power.
5. Open the new account → **Keys → Add key → JSON**. A `.json` file downloads. Treat this like a password — never commit it.

That file is your credential. The `client_email` inside it is what the spreadsheet must be shared with.

## 2 — Create or pick a spreadsheet

You have two paths:

**A) Let the script create one (easiest).** Run `npm run sheets:init` with no `GOOGLE_SHEETS_ID` and it provisions a fresh spreadsheet titled "DM-to-Deal · Pipeline". The service account becomes the owner — share it back to yourself from the UI if you want to view it as you.

**B) Use an existing spreadsheet.** Create a blank Sheet in your own Drive, copy the 44-character ID out of the URL (`https://docs.google.com/spreadsheets/d/<this part>/edit`), and share that sheet with the service account email as **Editor**.

## 3 — Configure env

In `.env` (which is git-ignored):

```bash
DM_STORE=sheets
GOOGLE_SHEETS_ID=<spreadsheet id>
GOOGLE_SERVICE_ACCOUNT_JSON=./creds.json
# Or paste the JSON inline (single line) — useful for cloud deploys
# GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Path or inline JSON — the loader inspects the first non-whitespace character to disambiguate.

## 4 — Provision the look

```bash
npm run sheets:init
```

You'll see:

```
provisioning spreadsheet: <id>
✓ done — open it:
  https://docs.google.com/spreadsheets/d/<id>

Share this spreadsheet with the service-account email (Editor access):
  dm-to-deal-sheets@<project>.iam.gserviceaccount.com
```

Open the URL. You should see four tabs, a branded Dashboard with KPI tiles, and an empty Leads tab styled like a high-ticket SaaS product.

## 5 — Use it

Start the agent with `DM_STORE=sheets` in env and every lead capture, message, and stage change writes to the spreadsheet. The dashboard tiles and funnel formulas update live.

## Security posture

- **Least privilege.** The service account is scoped to `spreadsheets` only — *not* Drive. It can read/write the one sheet it's been shared with and nothing else.
- **No formula injection.** All writes use `valueInputOption=RAW`, so a lead's name or message can never become an executable formula. The codec also defangs leading `= + - @` characters as belt-and-braces.
- **No PII in logs.** The client never logs request/response bodies (`src/crm/sheets/client.ts`). Only errors carry HTTP status + API message.
- **Schema-versioned state.** The hidden `__state` column has a version byte. Future incompatible changes are rejected instead of silently misinterpreted.

## Troubleshooting

| What you see | What it means |
|---|---|
| `403 The caller does not have permission` | You forgot to share the sheet with the service account email. |
| `404 Requested entity was not found` | `GOOGLE_SHEETS_ID` is wrong — copy it from the URL, not the file name. |
| `400 Unable to parse range: Leads!A2:M` | The `Leads` tab is missing. Re-run `npm run sheets:init`. |
| `sheets.auth: failed to read service-account file` | `GOOGLE_SERVICE_ACCOUNT_JSON` points to a path that doesn't exist or isn't readable. |

## What it can't do (yet)

Single-instance write semantics — two concurrent webhooks for the same lead can race and last-write-wins. Phase 2 moves to Redis-backed locks. See `docs/ROADMAP.md`.
