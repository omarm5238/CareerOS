import { prisma } from "@/server/db/prisma";

import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { saveAnswerPreference } from "../answers/resolve-answer-preference";
import { generateFreeTextAnswer } from "../answers/generate-free-text-answer";
import { toPrismaJson } from "../lib/json-parsers";
import { ExecutionAccessError } from "../lib/permissions";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import type { ConfirmOutcome } from "../types";

export async function patchFieldAnswer(
  userId: string,
  sessionId: string,
  fieldId: string,
  input: { value?: unknown; confirmed?: boolean; savePreference?: boolean; reviewed?: boolean },
) {
  const row = await loadOwnedSession(userId, sessionId);
  const { snapshot, plan } = sessionJson(row);
  const field = snapshot?.fields.find((item) => item.externalId === fieldId);
  if (!field) throw new ExecutionAccessError("INVALID_INPUT", "That field is not in the current inspection.");
  const answer = plan.answers.find((item) => item.fieldId === fieldId);
  if (!answer) throw new ExecutionAccessError("INVALID_INPUT", "That field is not in the current fill plan.");

  if (field.classification === "ASSESSMENT") {
    throw new ExecutionAccessError("INVALID_INPUT", "CareerOS does not answer assessments.");
  }
  if (typeof input.value === "string") {
    answer.value = input.value;
    if (field.classification === "FREE_TEXT") {
      answer.source = answer.source === "AI_GENERATED" ? "AI_GENERATED" : "USER_CONFIRMED";
    } else {
      answer.source = "USER_CONFIRMED";
    }
  }
  if (input.confirmed) {
    answer.confirmed = true;
    answer.status = "AUTO_FILL";
    answer.requiresConfirmation = false;
    if (field.classification === "LEGAL") {
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "USER_INPUT_REQUIRED",
        message: "Work authorization confirmation received.",
      });
    }
  }
  if (input.reviewed && field.classification === "FREE_TEXT") {
    answer.reviewed = true;
    answer.confirmed = true;
    answer.status = "AUTO_FILL";
  }
  if (input.savePreference && field.classification !== "SENSITIVE" && typeof answer.value === "string") {
    await saveAnswerPreference({
      userId,
      key: field.normalizedLabel,
      category: field.classification,
      value: answer.value,
      scopeType: field.classification === "LEGAL" ? "JOB_SPECIFIC" : field.classification === "CONTACT" ? "GLOBAL" : "JOB_SPECIFIC",
      scopeValue: field.classification === "CONTACT" ? "" : row.jobPostingId,
      requiresPerApplicationConfirmation: field.classification === "LEGAL",
    });
  }

  const page = getApplicationBrowserRunner().getPage(sessionId);
  if (page && answer.confirmed && answer.value != null) {
    const adapter = selectAdapter(row.provider, false);
    if (field.classification === "CONSENT" || field.type !== "FILE") {
      await adapter.fillField(page, field.selector.value, field.type, answer.value);
    }
  }

  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { fillPlanJson: toPrismaJson(plan), lastActivityAt: new Date() },
  });
  return loadOwnedSession(userId, sessionId);
}

export async function generateFieldAnswer(userId: string, sessionId: string, fieldId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const { snapshot, plan } = sessionJson(row);
  const field = snapshot?.fields.find((item) => item.externalId === fieldId);
  if (!field) throw new ExecutionAccessError("INVALID_INPUT", "That field is not in the current inspection.");
  if (field.classification !== "FREE_TEXT") {
    throw new ExecutionAccessError("INVALID_INPUT", "AI generation is only available for free-text questions.");
  }
  const generated = await generateFreeTextAnswer({
    userId,
    jobTitle: row.jobPosting.title,
    company: row.jobPosting.company,
    jobDescription: row.jobPosting.description,
    resumeRevisionId: row.applicationPackage.resumeVersionRevisionId,
    fieldLabel: field.label,
  });
  const answer = plan.answers.find((item) => item.fieldId === fieldId);
  if (!answer) throw new ExecutionAccessError("INVALID_INPUT", "That field is not in the current fill plan.");
  if (generated.ok) {
    answer.originalGeneratedValue = generated.text;
    answer.value = generated.text;
    answer.source = "AI_GENERATED";
    answer.status = "REVIEW_REQUIRED";
    answer.reviewed = false;
    answer.requiresConfirmation = true;
  } else {
    answer.status = "NEEDS_INPUT";
    answer.reviewed = false;
  }
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { fillPlanJson: toPrismaJson(plan), lastActivityAt: new Date() },
  });
  return { ok: generated.ok, text: generated.text, status: answer.status };
}

export type { ConfirmOutcome };
