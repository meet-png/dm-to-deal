/**
 * Account-safety pacing (PRD §8). Instagram bans accounts that behave like
 * bots. Two guards keep us human and under Meta's radar:
 *
 *   1. Per-account daily send cap (default 60/day).
 *   2. Randomized human-like delay (2-8 min) before each reply.
 *
 * Both are pure/injectable so they're deterministic in tests.
 */

export interface PacingOptions {
  minDelaySeconds: number;
  maxDelaySeconds: number;
  maxMessagesPerDay: number;
  /** Injectable RNG for tests (defaults to Math.random). */
  rng?: () => number;
  /** Injectable clock for tests (defaults to () => new Date()). */
  now?: () => Date;
}

export class Pacer {
  private readonly rng: () => number;
  private readonly now: () => Date;
  /** day (YYYY-MM-DD) -> messages sent that day. */
  private readonly dailyCount = new Map<string, number>();

  constructor(private readonly opts: PacingOptions) {
    if (opts.minDelaySeconds > opts.maxDelaySeconds) {
      throw new Error("pacing: minDelaySeconds must be <= maxDelaySeconds");
    }
    this.rng = opts.rng ?? Math.random;
    this.now = opts.now ?? (() => new Date());
  }

  /** A randomized human-like delay (ms) to wait before sending a reply. */
  nextDelayMs(): number {
    const span = this.opts.maxDelaySeconds - this.opts.minDelaySeconds;
    const seconds = this.opts.minDelaySeconds + this.rng() * span;
    return Math.round(seconds * 1000);
  }

  /** True if we still have daily quota left for the connected account. */
  canSendToday(): boolean {
    return this.sentToday() < this.opts.maxMessagesPerDay;
  }

  /** Record a sent message against today's quota. Call AFTER a successful send. */
  recordSend(): void {
    const key = this.dayKey();
    this.dailyCount.set(key, (this.dailyCount.get(key) ?? 0) + 1);
  }

  sentToday(): number {
    return this.dailyCount.get(this.dayKey()) ?? 0;
  }

  private dayKey(): string {
    return this.now().toISOString().slice(0, 10);
  }
}
