import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { log } from "../lib/logger.js";
import {
  EXAMPLE_PROFILE,
  PersonalityProfileSchema,
  type PersonalityProfile,
} from "./profile.js";

/**
 * Loads the influencer's PersonalityProfile at boot.
 *
 * Selection:
 *   - `DM_PROFILE_PATH` set → read + validate that JSON file (fail fast on
 *     bad shape so a broken profile never reaches Claude in prod).
 *   - unset → use `EXAMPLE_PROFILE` so the demo runs with zero setup.
 *
 * Path resolution is relative to `process.cwd()` (the repo root when using
 * `npm run dev`). Errors are wrapped with the resolved path so misconfigured
 * deploys tell you exactly where they were looking.
 */
export function loadProfile(profilePath: string | undefined): PersonalityProfile {
  if (!profilePath) {
    log.info("profile.default", {
      name: EXAMPLE_PROFILE.name,
      reason: "DM_PROFILE_PATH unset",
    });
    return EXAMPLE_PROFILE;
  }

  const abs = resolve(process.cwd(), profilePath);

  let raw: string;
  try {
    raw = readFileSync(abs, "utf8");
  } catch (err) {
    throw new Error(
      `Failed to read profile at ${abs}: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Profile at ${abs} is not valid JSON: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  const parsed = PersonalityProfileSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Profile at ${abs} failed validation:\n${issues}`);
  }

  log.info("profile.loaded", { name: parsed.data.name, path: abs });
  return parsed.data;
}
