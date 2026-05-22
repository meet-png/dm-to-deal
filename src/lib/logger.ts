/**
 * Tiny structured logger. Emits one JSON line per event so logs are
 * grep-able and ship cleanly to any log aggregator. No dependency weight.
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  (level === "error" ? console.error : console.log)(line);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) =>
    process.env.DM_DEBUG ? emit("debug", msg, fields) : undefined,
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
