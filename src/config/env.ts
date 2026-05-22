import { z } from "zod";

/**
 * Validated, typed application config. Fail fast at boot if required env
 * vars are missing or malformed — never discover it mid-conversation.
 */
const EnvSchema = z.object({
  // Optional: when absent, the agent runs in scripted demo mode (no API
  // calls, no cost) — which is what makes the public simulator safe to expose.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // Seed a few example leads at boot so the dashboard is populated for demos.
  DM_SEED_DEMO: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // CORS allow-list for the dashboard origin(s), comma-separated.
  DM_CORS_ORIGINS: z.string().default("http://localhost:3001"),

  DM_MODEL: z.string().default("claude-opus-4-7"),
  DM_EFFORT: z.enum(["low", "medium", "high", "max"]).default("low"),
  DM_THINKING: z.enum(["disabled", "adaptive"]).default("disabled"),

  PORT: z.coerce.number().int().positive().default(3000),

  DM_CHANNEL: z.enum(["mock", "manychat"]).default("mock"),
  MANYCHAT_API_TOKEN: z.string().optional(),
  MANYCHAT_WEBHOOK_SECRET: z.string().optional(),

  DM_STORE: z.enum(["memory", "sheets"]).default("memory"),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  CALENDLY_BOOKING_URL: z
    .string()
    .url()
    .default("https://calendly.com/your-handle/strategy-call"),

  DM_MIN_REPLY_DELAY_SECONDS: z.coerce.number().nonnegative().default(120),
  DM_MAX_REPLY_DELAY_SECONDS: z.coerce.number().nonnegative().default(480),
  DM_MAX_MESSAGES_PER_DAY: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parse and cache process.env once. Throws a readable error on misconfig. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — reset the memoized config. */
export function resetEnvCache(): void {
  cached = undefined;
}
