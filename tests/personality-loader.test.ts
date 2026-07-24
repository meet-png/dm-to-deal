import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProfile } from "../src/personality/loader.js";
import { EXAMPLE_PROFILE } from "../src/personality/profile.js";

describe("loadProfile", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "dm-profile-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const validProfile = {
    name: "Test Coach",
    niche: "productivity",
    offer: "a 6-week deep work coaching sprint",
    tone: "calm, direct, no hype",
    signaturePhrases: ["ship the boring version"],
    emojiHabits: "none",
    commonObjections: ["I'm too busy already"],
    recentCaptions: ["Stop context-switching. Batch or die."],
    leadMagnet: "my 3-page focus template",
  };

  it("falls back to EXAMPLE_PROFILE when no path is provided", () => {
    expect(loadProfile(undefined)).toBe(EXAMPLE_PROFILE);
  });

  it("loads and validates a well-formed JSON profile", () => {
    const p = join(dir, "good.json");
    writeFileSync(p, JSON.stringify(validProfile));
    const loaded = loadProfile(p);
    expect(loaded.name).toBe("Test Coach");
    expect(loaded.leadMagnet).toBe("my 3-page focus template");
    expect(loaded.recentCaptions).toHaveLength(1);
  });

  it("defaults recentCaptions to [] so a day-one questionnaire is enough", () => {
    const p = join(dir, "no-captions.json");
    const { recentCaptions: _drop, ...withoutCaptions } = validProfile;
    writeFileSync(p, JSON.stringify(withoutCaptions));
    expect(loadProfile(p).recentCaptions).toEqual([]);
  });

  it("throws a readable error when the file is missing", () => {
    expect(() => loadProfile(join(dir, "does-not-exist.json"))).toThrow(
      /Failed to read profile/,
    );
  });

  it("throws a readable error on malformed JSON", () => {
    const p = join(dir, "bad.json");
    writeFileSync(p, "{ this is not json");
    expect(() => loadProfile(p)).toThrow(/is not valid JSON/);
  });

  it("throws with field-level detail when required fields are missing", () => {
    const p = join(dir, "incomplete.json");
    writeFileSync(p, JSON.stringify({ name: "x", niche: "y" }));
    expect(() => loadProfile(p)).toThrow(/failed validation/);
  });

  it("rejects empty signaturePhrases (voice IP would be useless)", () => {
    const p = join(dir, "empty-phrases.json");
    writeFileSync(p, JSON.stringify({ ...validProfile, signaturePhrases: [] }));
    expect(() => loadProfile(p)).toThrow(/signaturePhrases/);
  });
});
