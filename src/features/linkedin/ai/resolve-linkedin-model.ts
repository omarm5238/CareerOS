import { getAiConfig } from "@/server/ai";

export function resolveLinkedinModel(): string {
  return (
    process.env.OPENAI_LINKEDIN_MODEL?.trim() ||
    process.env.OPENAI_COMMUNICATIONS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    getAiConfig().model
  );
}
