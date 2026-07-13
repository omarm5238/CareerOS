export const MAX_AI_INPUT_CHARACTERS = 8000;

export function limitResumeTextForAi(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= MAX_AI_INPUT_CHARACTERS) {
    return { text, truncated: false };
  }

  return {
    text: text.slice(0, MAX_AI_INPUT_CHARACTERS),
    truncated: true,
  };
}
