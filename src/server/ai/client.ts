import OpenAI from "openai";

import { getAiConfig } from "./config";

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;

export function getOpenAIClient(): OpenAI | null {
  const { apiKey, hasApiKey } = getAiConfig();

  if (!hasApiKey || !apiKey) {
    cachedClient = null;
    cachedApiKey = null;
    return null;
  }

  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return cachedClient;
}

export function isAiConfigured(): boolean {
  return getAiConfig().hasApiKey;
}
