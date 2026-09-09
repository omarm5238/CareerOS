import { generateJsonWithAI, getAiConfig } from "@/server/ai";

import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";
import { prisma } from "@/server/db/prisma";

const SYSTEM = `You draft job-application free-text answers.

Rules:
- Use only facts in the provided context.
- Do not invent experience, metrics, years, company familiarity, recruiter conversations, salary, legal status, or certifications.
- If a fact is missing, write that it is not stated in the provided materials.
- Return JSON: {"text": string, "warnings": string[]}`;

export async function generateFreeTextAnswer(input: {
  userId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeRevisionId: string | null;
  fieldLabel: string;
}): Promise<{ text: string; model: string | null; ok: boolean }> {
  const resume = input.resumeRevisionId
    ? await prisma.resumeVersionRevision.findFirst({
        where: { id: input.resumeRevisionId, userId: input.userId },
      })
    : null;
  const content = resume ? parseResumeVersionContent(resume.contentJson) : null;
  const userPrompt = JSON.stringify({
    question: input.fieldLabel,
    job: { title: input.jobTitle, company: input.company, description: input.jobDescription.slice(0, 4000) },
    resume: content
      ? {
          summary: content.summary,
          skills: content.coreSkills,
          experience: content.experienceBullets.map((item) => item.tailored).slice(0, 8),
        }
      : null,
  });

  const model =
    process.env.OPENAI_APPLICATION_EXECUTION_MODEL?.trim() ||
    process.env.OPENAI_COMMUNICATIONS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    getAiConfig().model;

  const result = await generateJsonWithAI<{ text?: unknown; warnings?: unknown }>({
    taskName: "application-execution-free-text",
    model,
    timeoutMs: Number(process.env.OPENAI_APPLICATION_EXECUTION_TIMEOUT_MS) || 40_000,
    temperature: 0.2,
    systemPrompt: SYSTEM,
    userPrompt,
  });

  if (!result.ok || typeof result.data.text !== "string" || !result.data.text.trim()) {
    return { text: "", model: result.ok ? result.model : model, ok: false };
  }
  return { text: result.data.text.trim(), model: result.model, ok: true };
}
