import { PROVIDER_TIMEOUT_MS } from "../constants";

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly category: "TIMEOUT" | "RATE_LIMITED" | "NETWORK_ERROR" | "INVALID_RESPONSE" | "UNKNOWN",
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export async function fetchJson(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  timeoutMs = PROVIDER_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "CareerOS",
        ...(init.headers ?? {}),
      },
    });
    if (response.status === 429) throw new ProviderRequestError("Provider rate limited the request", "RATE_LIMITED");
    if (!response.ok) {
      throw new ProviderRequestError(`HTTP ${response.status}`, response.status >= 500 ? "NETWORK_ERROR" : "INVALID_RESPONSE");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.message.includes("abort"))) {
      throw new ProviderRequestError("timeout", "TIMEOUT");
    }
    throw new ProviderRequestError(error instanceof Error ? error.message : "network", "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}
