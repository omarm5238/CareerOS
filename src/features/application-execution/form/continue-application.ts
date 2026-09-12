import { prisma } from "@/server/db/prisma";

import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { ExecutionAccessError } from "../lib/permissions";
import { toPrismaJson } from "../lib/json-parsers";
import { recordExecutionEvent } from "../sessions/execution-event";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { inspectAndPlan, fillSafeFields } from "./inspect-form";
import { validateCurrentStep } from "./validate-current-step";

function formatPhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export async function continueApplication(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const { snapshot, plan } = sessionJson(row);
  const phoneField = snapshot?.fields.find((field) => field.type === "PHONE");
  const phoneAnswer = plan.answers.find((item) => item.fieldId === phoneField?.externalId);
  if (phoneField && typeof phoneAnswer?.value === "string" && /[^\d+]/.test(phoneAnswer.value)) {
    const page = getApplicationBrowserRunner().getPage(sessionId);
    if (page) {
      const adapter = selectAdapter(row.provider, false);
      const formatted = formatPhone(phoneAnswer.value);
      await adapter.fillField(page, phoneField.selector.value, "PHONE", formatted);
      phoneAnswer.value = formatted;
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { fillPlanJson: toPrismaJson(plan), lastActivityAt: new Date() },
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "VALIDATION_ERROR",
        message: "Applied a safe phone-format correction and revalidated the field.",
      });
    }
  }

  const validation = await validateCurrentStep(userId, sessionId);
  if (!validation.ok) {
    const { snapshot, plan } = sessionJson(row);
    const phoneField = snapshot?.fields.find((field) => field.type === "PHONE");
    const phoneAnswer = plan.answers.find((item) => item.fieldId === phoneField?.externalId);
    if (validation.recoverableFormat && phoneField && typeof phoneAnswer?.value === "string") {
      const page = getApplicationBrowserRunner().getPage(sessionId);
      if (page) {
        const adapter = selectAdapter(row.provider, false);
        const formatted = formatPhone(phoneAnswer.value);
        await adapter.fillField(page, phoneField.selector.value, "PHONE", formatted);
        phoneAnswer.value = formatted;
        await prisma.applicationExecutionSession.update({
          where: { id: sessionId },
          data: { fillPlanJson: toPrismaJson(plan), lastActivityAt: new Date() },
        });
        await recordExecutionEvent(prisma, {
          userId,
          executionSessionId: sessionId,
          type: "VALIDATION_ERROR",
          message: "Applied a safe phone-format correction and revalidated the field.",
        });
      }
    } else {
      throw new ExecutionAccessError("CONFLICT", validation.message ?? "Continue is blocked until required fields are resolved.");
    }
    const again = await validateCurrentStep(userId, sessionId);
    if (!again.ok) {
      throw new ExecutionAccessError("CONFLICT", again.message ?? "Continue is blocked until required fields are resolved.");
    }
  }

  const page = getApplicationBrowserRunner().getPage(sessionId);
  if (!page) throw new ExecutionAccessError("CONFLICT", "Browser is not connected.");
  const adapter = selectAdapter(row.provider, false);
  const next = await adapter.locateNextControl(page);
  const submit = await adapter.locateFinalSubmit(page);
  if (submit?.isFinal && (!next || submit.confidence >= (next.confidence ?? 0)) && !next) {
    throw new ExecutionAccessError("CONFLICT", "Final submit remains manual or requires explicit submit approval.");
  }
  if (!next) {
    throw new ExecutionAccessError("CONFLICT", "No trusted Next control was found.");
  }
  if (submit && next.selector.value === submit.selector.value) {
    throw new ExecutionAccessError("CONFLICT", "Refusing to click a control that looks like final submit.");
  }
  await adapter.advanceStep(page, next.selector.value);
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "STEP_ADVANCED",
    message: "Advanced a non-final application step.",
  });
  await inspectAndPlan(userId, sessionId, { navigate: false, fillSafe: false });
  return fillSafeFields(userId, sessionId);
}
