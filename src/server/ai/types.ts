export type AiDiagnostic = {
  hasApiKey: boolean;
  model: string;
  reason: string;
  timedOut?: boolean;
  jsonValidationFailed?: boolean;
  errorName?: string;
  code?: string;
  status?: number;
  message?: string;
};

export type GenerateJsonWithAiOptions = {
  taskName: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  model?: string;
  temperature?: number;
  fallbackLabel?: string;
};

export type GenerateJsonWithAiSuccess<T> = {
  ok: true;
  data: T;
  model: string;
};

export type GenerateJsonWithAiFailure = {
  ok: false;
  diagnostic: AiDiagnostic;
};

export type GenerateJsonWithAiResult<T> =
  | GenerateJsonWithAiSuccess<T>
  | GenerateJsonWithAiFailure;

export type AiTimeoutFailure = {
  ok: false;
  timedOut: true;
  errorName: string;
  message: string;
};
