import { describe, it, expect } from "vitest";
import { Pacer } from "../src/compliance/pacing.js";

describe("Pacer", () => {
  const base = {
    minDelaySeconds: 120,
    maxDelaySeconds: 480,
    maxMessagesPerDay: 3,
  };

  it("produces delays within the configured human-like window", () => {
    const lo = new Pacer({ ...base, rng: () => 0 });
    const hi = new Pacer({ ...base, rng: () => 1 });
    expect(lo.nextDelayMs()).toBe(120_000);
    expect(hi.nextDelayMs()).toBe(480_000);
  });

  it("enforces the daily send cap to protect the account", () => {
    const pacer = new Pacer(base);
    expect(pacer.canSendToday()).toBe(true);
    pacer.recordSend();
    pacer.recordSend();
    pacer.recordSend();
    expect(pacer.canSendToday()).toBe(false);
  });

  it("resets the cap on a new day", () => {
    let day = new Date("2026-05-22T10:00:00Z");
    const pacer = new Pacer({ ...base, maxMessagesPerDay: 1, now: () => day });
    pacer.recordSend();
    expect(pacer.canSendToday()).toBe(false);
    day = new Date("2026-05-23T10:00:00Z");
    expect(pacer.canSendToday()).toBe(true);
  });

  it("rejects an inverted delay window", () => {
    expect(() => new Pacer({ ...base, minDelaySeconds: 500 })).toThrow();
  });
});
