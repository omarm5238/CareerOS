import { getAiConfig } from "@/server/ai";

export function limitJobDescriptionForAi(description: string): {
  text: string;
  truncated: boolean;
} {
  const maxChars = getAiConfig().maxInputChars;
  const trimmed = description.trim();

  if (trimmed.length <= maxChars) {
    return { text: trimmed, truncated: false };
  }

  return {
    text: trimmed.slice(0, maxChars),
    truncated: true,
  };
}
