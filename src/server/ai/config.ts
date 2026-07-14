const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_INPUT_CHARS = 8_000;
const DEFAULT_MODEL = "gpt-5.5-mini";

export type AiConfig = {
  hasApiKey: boolean;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxInputChars: number;
};

export function getAiConfig(): AiConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  return {
    hasApiKey: !!apiKey,
    apiKey: apiKey || undefined,
    model,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxInputChars: DEFAULT_MAX_INPUT_CHARS,
  };
}

export function getOpenAIModelName(): string {
  return getAiConfig().model;
}
