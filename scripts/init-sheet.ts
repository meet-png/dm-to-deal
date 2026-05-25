/**
 * `npm run sheets:init`
 *
 * Provision (or upgrade) the Google Sheet that backs DM-to-Deal so it looks
 * like a high-ticket service product, not a default spreadsheet. Safe to
 * re-run — every step is idempotent.
 *
 * Usage:
 *   GOOGLE_SHEETS_ID=...                 # the spreadsheet to provision
 *   GOOGLE_SERVICE_ACCOUNT_JSON=./creds.json   # path OR inline JSON
 *   npm run sheets:init
 *
 * If GOOGLE_SHEETS_ID is omitted the script creates a new spreadsheet titled
 * "DM-to-Deal · Pipeline" and prints its ID + share URL.
 */

// Load `.env` BEFORE any code that reads `process.env`. The side-effect
// import is intentional — it has to run first, before our config module.
import "dotenv/config";

import { loadEnv } from "../src/config/env.js";
import { authFromEnv } from "../src/crm/sheets/auth.js";
import { SheetsClient } from "../src/crm/sheets/client.js";
import { provisionSpreadsheet } from "../src/crm/sheets/provision.js";

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    fail(
      "GOOGLE_SERVICE_ACCOUNT_JSON is required. Set it in .env or as a " +
        "shell env var (file path OR inline JSON).",
    );
  }

  // Diagnostics — print what we actually loaded, so a 403 or "wrong sheet"
  // is debuggable without spelunking. We redact credential content; only
  // its presence + the service-account email (which is meant to be shared)
  // are shown.
  log("─ environment ──────────────────────────────────────────────");
  log(`  GOOGLE_SHEETS_ID            : ${env.GOOGLE_SHEETS_ID ?? "(unset → will create new)"}`);
  log(`  GOOGLE_SERVICE_ACCOUNT_JSON : ${describeCredSource(env.GOOGLE_SERVICE_ACCOUNT_JSON)}`);
  log("");

  const { jwt, clientEmail } = await authFromEnv(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const client = new SheetsClient(jwt);

  log(`  service-account email       : ${clientEmail}`);
  log("─────────────────────────────────────────────────────────────");
  log("");

  let spreadsheetId = env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    log("creating a new spreadsheet — no GOOGLE_SHEETS_ID supplied");
    const created = await client.createSpreadsheet("DM-to-Deal · Pipeline");
    spreadsheetId = created.spreadsheetId;
    log(`created spreadsheet: ${spreadsheetId}`);
    log(`URL:                 https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    log("");
    log("IMPORTANT: a service-account-created spreadsheet is owned by the");
    log("service account, not your Google account. Share it back to your own");
    log("email from the Sheets UI if you want to view/edit it as you.");
    log("");
  }

  log(`provisioning spreadsheet: ${spreadsheetId}`);
  try {
    await provisionSpreadsheet(client, spreadsheetId);
  } catch (err) {
    // The most common failure here is 403 — the service account doesn't have
    // access to the spreadsheet. Translate that to actionable next-steps.
    const msg = (err as Error).message;
    if (msg.includes("403") || msg.toLowerCase().includes("permission")) {
      log("");
      log("✗ Google Sheets returned 403 — the service account can't see this sheet.");
      log("");
      log("  Open the sheet in your browser and click Share. Add this email");
      log("  as an Editor, then re-run:");
      log("");
      log(`      ${clientEmail}`);
      log("");
      log("  Also verify the GOOGLE_SHEETS_ID in .env matches the spreadsheet");
      log("  ID in the URL (the long token between /d/ and /edit).");
      log("");
    }
    throw err;
  }
  log("");
  log("✓ done — open it:");
  log(`  https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  log("");
  log("Share this spreadsheet with the service-account email (Editor access):");
  log(`  ${clientEmail}`);
  log("");
  log("Then set DM_STORE=sheets in your .env and the agent will use it.");
}

/** Describe the credential source without leaking its content. */
function describeCredSource(source: string | undefined): string {
  if (!source) return "(unset)";
  const trimmed = source.trimStart();
  if (trimmed.startsWith("{")) return `inline JSON (${trimmed.length} chars)`;
  return `path → ${source}`;
}

function log(line: string): void {
  // Plain stdout — this is a CLI, not a service log. Keep it readable.
  console.log(line);
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

main().catch((err) => {
  fail((err as Error).message);
});
