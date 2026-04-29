import { ENV } from "./env";

/**
 * Console-backed logger for Vercel serverless. Avoids `pino` init/worker behavior
 * that can crash the isolate with FUNCTION_INVOCATION_FAILED before the handler runs.
 *
 * Call shape matches pino: log.info({ key }, "message") or log.info("message").
 */
const weights: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const minW = weights[(ENV.LOG_LEVEL || "info").toLowerCase()] ?? 30;

function emit(
  level: keyof typeof weights,
  write: typeof console.error,
  first: unknown,
  msg?: string,
): void {
  if ((weights[level] ?? 30) < minW) return;
  if (msg !== undefined) write(first, msg);
  else write(first);
}

export const log = {
  trace: (first: unknown, msg?: string) => emit("trace", console.debug, first, msg),
  debug: (first: unknown, msg?: string) => emit("debug", console.debug, first, msg),
  info: (first: unknown, msg?: string) => emit("info", console.info, first, msg),
  warn: (first: unknown, msg?: string) => emit("warn", console.warn, first, msg),
  error: (first: unknown, msg?: string) => emit("error", console.error, first, msg),
  fatal: (first: unknown, msg?: string) => emit("fatal", console.error, first, msg),
};
