import { prisma } from "@/server/db/prisma";

import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";

import type { ApplicationFormField, ResolvedApplicationAnswer } from "../types";
import { findAnswerPreference } from "./resolve-answer-preference";

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function extractUrl(text: string, kind: "github" | "linkedin" | "portfolio"): string | null {
  const match =
    kind === "github"
      ? text.match(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+/i)
      : kind === "linkedin"
        ? text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[A-Za-z0-9_/.-]+/i)
        : text.match(/https?:\/\/[^\s]+/i);
  return match?.[0] ?? null;
}

export async function resolveApplicationAnswer(input: {
  userId: string;
  field: ApplicationFormField;
  resumeRevisionId: string | null;
  jobPostingId: string;
  existing?: ResolvedApplicationAnswer | null;
}): Promise<ResolvedApplicationAnswer> {
  const field = input.field;
  const existing = input.existing;
  if (existing?.confirmed || existing?.reviewed) return existing;
  if (existing && existing.value != null && existing.value !== "") return existing;

  const base: ResolvedApplicationAnswer = {
    fieldId: field.externalId,
    classification: field.classification,
    value: null,
    source: null,
    confidence: 0,
    status: field.required ? "NEEDS_INPUT" : "OPTIONAL_EMPTY",
    requiresConfirmation: false,
    confirmed: false,
    reviewed: false,
    savePreference: false,
  };

  if (field.classification === "LEGAL") {
    const saved = await findAnswerPreference(input.userId, field.normalizedLabel, "LEGAL", input.jobPostingId);
    return {
      ...base,
      status: "NEEDS_INPUT",
      requiresConfirmation: true,
      source: saved ? "SAVED_USER_ANSWER" : null,
      originalGeneratedValue: saved?.preview ?? null,
    };
  }
  if (field.classification === "SENSITIVE" || field.classification === "CONSENT" || field.classification === "ASSESSMENT") {
    return {
      ...base,
      status: field.classification === "CONSENT" ? "NEEDS_INPUT" : field.required ? "NEEDS_INPUT" : "OPTIONAL_EMPTY",
      requiresConfirmation: true,
    };
  }
  if (field.classification === "FREE_TEXT") {
    return { ...base, status: "REVIEW_REQUIRED", source: null, requiresConfirmation: true };
  }
  if (field.classification === "DOCUMENT") {
    return { ...base, status: "AUTO_FILL", confidence: 0.99, source: "APPLICATION_PACKAGE" };
  }
  if (field.type === "OTHER" && field.confidence < 0.5) {
    return { ...base, status: "BLOCKED", requiresConfirmation: true };
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } });
  const resume = input.resumeRevisionId
    ? await prisma.resumeVersionRevision.findFirst({ where: { id: input.resumeRevisionId, userId: input.userId } })
    : null;
  const content = resume ? parseResumeVersionContent(resume.contentJson) : null;
  const blob = `${content?.summary ?? ""} ${content?.projects.map((item) => item.tailored).join(" ") ?? ""}`;
  const names = splitName(user?.name ?? "");
  const label = field.normalizedLabel;

  const fact = (value: string, confidence: number, source: ResolvedApplicationAnswer["source"] = "PROFILE_FACT"): ResolvedApplicationAnswer => ({
    ...base,
    value,
    source,
    confidence,
    status: confidence >= 0.95 ? "AUTO_FILL" : confidence >= 0.8 ? "PROPOSE" : "NEEDS_INPUT",
    requiresConfirmation: confidence < 0.95,
  });

  if (/first name|given name|forename/.test(label) && names.first) return fact(names.first, 0.99);
  if (/last name|family name|surname/.test(label) && names.last) return fact(names.last, 0.99);
  if ((label === "name" || label === "full name") && user?.name) return fact(user.name, 0.97);
  if (/email/.test(label) && user?.email) return fact(user.email, 0.99);
  if (/github/.test(label)) {
    const url = extractUrl(blob, "github");
    return url ? fact(url, 0.96, "RESUME_REVISION") : base;
  }
  if (/linkedin/.test(label)) {
    const url = extractUrl(blob, "linkedin");
    return url ? fact(url, 0.96, "RESUME_REVISION") : base;
  }
  if (/portfolio|website/.test(label)) {
    const url = extractUrl(blob, "portfolio");
    return url ? fact(url, 0.9, "RESUME_REVISION") : { ...base, status: "PROPOSE", confidence: 0.82 };
  }
  if (/phone|mobile|tel/.test(label)) {
    const saved = await findAnswerPreference(input.userId, "phone", "CONTACT", input.jobPostingId);
    if (saved) return fact(saved.value, 0.96, "SAVED_USER_ANSWER");
    return { ...base, status: "NEEDS_INPUT" };
  }
  if (/years of/.test(label) || /how many years/.test(label)) {
    return { ...base, status: "NEEDS_INPUT", confidence: 0.2 };
  }
  if (field.classification === "UNKNOWN") {
    return { ...base, status: field.required ? "NEEDS_INPUT" : "OPTIONAL_EMPTY", confidence: field.confidence };
  }

  const saved = await findAnswerPreference(input.userId, label, field.classification, input.jobPostingId);
  if (saved && !saved.requiresPerApplicationConfirmation) {
    return fact(saved.value, 0.9, "SAVED_USER_ANSWER");
  }
  return base;
}
