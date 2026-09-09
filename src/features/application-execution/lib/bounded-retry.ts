import { PRE_SUBMIT_MAX_RETRIES } from "../types";

export async function withBoundedRetry<T>(
  operation: () => Promise<T>,
  retries = PRE_SUBMIT_MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transient = /detached|timeout|target closed|navigation|net::/i.test(message);
      if (!transient || attempt === retries) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Retry failed.");
}
