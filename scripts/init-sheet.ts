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

import { loadEnv } from "../src/config/env.js";
import { authFromEnv } from "../src/crm/sheets/auth.js";
import { SheetsClient } from "../src/crm/sheets/client.js";
import { provisionSpreadsheet } from "../src/crm/sheets/provision.js";

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    fail(
      "GOOGLE_SERVICE_ACCOUNT_JSON is required. Set it to a file path " +
        "(e.g. ./creds.json) or paste the JSON content inline.",
    );
  }

  const { jwt, clientEmail } = await authFromEnv(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const client = new SheetsClient(jwt);

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
  await provisionSpreadsheet(client, spreadsheetId);
  log("");
  log("✓ done — open it:");
  log(`  https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  log("");
  log("Share this spreadsheet with the service-account email (Editor access):");
  log(`  ${clientEmail}`);
  log("");
  log("Then set DM_STORE=sheets in your .env and the agent will use it.");
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
