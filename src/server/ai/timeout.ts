import type { AiTimeoutFailure } from "./types";

export async function withAiTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<{ ok: true; value: T } | AiTimeoutFailure> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const value = await operation(controller.signal);
    return { ok: true, value };
  } catch (error) {
    if (error instanceof Error) {
      const isAbort =
        error.name === "AbortError" || /abort/i.test(error.message);

      if (isAbort) {
        return {
          ok: false,
          timedOut: true,
          errorName: error.name,
          message: error.message || "AI request timed out",
        };
      }
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
