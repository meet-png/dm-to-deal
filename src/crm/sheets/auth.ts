import { readFile } from "node:fs/promises";
import { JWT } from "google-auth-library";
import { z } from "zod";

/**
 * Service-account auth for the Google Sheets API.
 *
 * SECURITY POSTURE
 * - Scope is locked to `spreadsheets` only — NOT Drive. The service account
 *   can read/write the single spreadsheet it has been explicitly shared with,
 *   and nothing else. This is the narrowest scope Sheets supports.
 * - Credentials come from env (`GOOGLE_SERVICE_ACCOUNT_JSON`) as either a path
 *   or the raw JSON content. Inline content supports cloud deploys with no
 *   writable filesystem; the path form keeps a local dev key off the env.
 * - The parsed key never leaves this module. The exported client carries the
 *   JWT but exposes no read-access to the private key material.
 * - Errors include the source kind (path/inline) but never the key.
 */

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** Shape of the credential JSON we accept. Extra fields are ignored. */
const ServiceAccountSchema = z.object({
  type: z.literal("service_account"),
  client_email: z.string().email(),
  private_key: z.string().min(64),
  project_id: z.string().min(1).optional(),
});

export type ServiceAccount = z.infer<typeof ServiceAccountSchema>;

/**
 * Load and validate a service-account credential from env.
 *
 * Disambiguates path vs inline JSON by looking at the first non-whitespace
 * character: `{` → inline JSON, anything else → file path. This is robust
 * because a valid JSON object always starts with `{`, and a valid file path
 * never does on Windows or POSIX.
 */
export async function loadServiceAccount(source: string): Promise<ServiceAccount> {
  const trimmed = source.trimStart();
  let raw: string;
  let kind: "inline" | "path";

  if (trimmed.startsWith("{")) {
    raw = trimmed;
    kind = "inline";
  } else {
    kind = "path";
    try {
      raw = await readFile(source, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      // Do NOT echo the path back into the error if it might be a secret;
      // the path is fine to surface since it isn't a credential itself.
      throw new Error(
        `sheets.auth: failed to read service-account file (${code}). ` +
          `GOOGLE_SERVICE_ACCOUNT_JSON should be a readable file path or inline JSON.`,
      );
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `sheets.auth: service-account ${kind} content is not valid JSON. ` +
        `Did you base64-encode it by accident?`,
    );
  }

  const result = ServiceAccountSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `sheets.auth: service-account JSON failed validation. ` +
        `Required fields: type="service_account", client_email, private_key.`,
    );
  }
  return result.data;
}

/**
 * Build an authorised JWT client for the Sheets API.
 *
 * `JWT` from google-auth-library handles token refresh internally; callers
 * just await `getAccessToken()` and reuse the value until it expires (the
 * library caches it). We don't expose the private key downstream — only the
 * authorised client.
 */
export function createJwtClient(account: ServiceAccount): JWT {
  return new JWT({
    email: account.client_email,
    key: account.private_key,
    scopes: [SHEETS_SCOPE],
  });
}

/**
 * Convenience: load credentials and return a ready-to-use JWT client plus the
 * client_email (useful for the setup guide — the influencer needs to share
 * the spreadsheet with that email).
 */
export async function authFromEnv(source: string): Promise<{
  jwt: JWT;
  clientEmail: string;
}> {
  const account = await loadServiceAccount(source);
  return { jwt: createJwtClient(account), clientEmail: account.client_email };
}
