import { prisma } from "@/server/db/prisma";

import { detectProvider, selectAdapter, adapterSupportsConfirmedSubmit } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { resolveApplicationAnswer } from "../answers/resolve-application-answer";
import { buildFormFingerprint } from "../form/form-fingerprint";
import { toPrismaJson } from "../lib/json-parsers";
import { withBoundedRetry } from "../lib/bounded-retry";
import type { FillPlan, PendingAction, ResolvedApplicationAnswer } from "../types";
import { ADAPTER_VERSION } from "../types";
import { recordExecutionEvent } from "../sessions/execution-event";
import { applyUrlFromJob, loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { assertTransition } from "../sessions/execution-state-machine";
import type { ApplicationExecutionStatus } from "@/generated/prisma/client";

function pendingFromPlan(plan: FillPlan, snapshotFields: { externalId: string; type: string; classification: string; required: boolean; confidence: number }[]): PendingAction[] {
  const actions: PendingAction[] = [];
  for (const field of snapshotFields) {
    if (field.type === "OTHER" && field.confidence < 0.5) {
      actions.push({
        kind: "UNSUPPORTED_WIDGET",
        fieldId: field.externalId,
        message: "CareerOS cannot safely operate this control. Handle it in the browser, then Resume.",
        failureCode: "UNSUPPORTED_WIDGET",
      });
    }
  }
  for (const answer of plan.answers) {
    if (answer.classification === "LEGAL" && !answer.confirmed) {
      actions.push({ kind: "LEGAL", fieldId: answer.fieldId, message: "Work authorization or another legal question needs confirmation for this application.", failureCode: "USER_INPUT_REQUIRED" });
    } else if (answer.classification === "SENSITIVE" && !answer.confirmed && answer.status !== "OPTIONAL_EMPTY") {
      actions.push({ kind: "SENSITIVE", fieldId: answer.fieldId, message: "A sensitive disclosure requires your decision. CareerOS will not suggest an answer.", failureCode: "USER_INPUT_REQUIRED" });
    } else if (answer.classification === "CONSENT" && !answer.confirmed) {
      actions.push({ kind: "CONSENT", fieldId: answer.fieldId, message: "Consent required. Review in the browser, then confirm.", failureCode: "CONSENT_REQUIRED" });
    } else if (answer.classification === "FREE_TEXT" && !answer.reviewed) {
      actions.push({ kind: "FREE_TEXT", fieldId: answer.fieldId, message: "Review the AI draft before this answer can be used.", failureCode: "USER_INPUT_REQUIRED" });
    } else if (answer.status === "NEEDS_INPUT" || answer.status === "BLOCKED") {
      actions.push({ kind: "USER_INPUT", fieldId: answer.fieldId, message: "This field needs your input.", failureCode: "USER_INPUT_REQUIRED" });
    }
  }
  return actions;
}

export async function inspectAndPlan(userId: string, sessionId: string, options?: { navigate?: boolean; fillSafe?: boolean }) {
  const row = await loadOwnedSession(userId, sessionId);
  const runner = getApplicationBrowserRunner();
  if (!runner.isAlive(sessionId)) {
    if (row.status === "SUBMITTING" || row.status === "VERIFYING") {
      await prisma.applicationExecutionSession.update({
        where: { id: sessionId },
        data: { status: "INTERRUPTED", failureCode: "SUBMISSION_UNCERTAIN", failureMessage: "Browser was lost after submit may have started." },
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "SESSION_INTERRUPTED",
        message: "Browser context was lost after a submit action may have been initiated. CareerOS will not click Submit again.",
      });
      throw Object.assign(new Error("SUBMISSION_UNCERTAIN"), { code: "SUBMISSION_UNCERTAIN" });
    }
    await runner.launch(sessionId);
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: sessionId,
      type: "BROWSER_STARTED",
      message: "Application browser started.",
    });
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "DETECTING_ATS", startedAt: row.startedAt ?? new Date(), lastActivityAt: new Date() },
    });
  }

  const page = runner.getPage(sessionId);
  if (!page) {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "INTERRUPTED", failureCode: "BROWSER_CRASHED", failureMessage: "Browser context is not available." },
    });
    throw Object.assign(new Error("BROWSER_CRASHED"), { code: "BROWSER_CRASHED" });
  }

  if (options?.navigate !== false) {
    const url = applyUrlFromJob(row.jobPosting.jobUrl);
    if (page.url() === "about:blank" || options?.navigate === true) {
      await runner.navigate(sessionId, url);
    }
  }

  await setStatus(sessionId, row.status, "DETECTING_ATS");
  let detection = await detectProvider(page);
  let drifted = false;
  let adapter = selectAdapter(detection.provider, false);
  try {
    await adapter.inspect(page);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "ADAPTER_DRIFT" || (error instanceof Error && error.message === "ADAPTER_DRIFT")) {
      drifted = true;
      adapter = selectAdapter("GENERIC", true);
      detection = { ...detection, provider: "GENERIC", drifted: true, reasons: [...detection.reasons, "adapter-drift"] };
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "ADAPTER_FALLBACK",
        message: "Dedicated adapter drifted. Fell back to Generic. Confirmed browser submit is disabled.",
      });
    } else {
      throw error;
    }
  }

  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "ATS_DETECTED",
    message: `${detection.provider} detected.`,
    metadata: { confidence: detection.confidence, reasons: detection.reasons, drifted },
  });

  await setStatus(sessionId, "DETECTING_ATS", "INSPECTING");
  const interruption = await adapter.detectInterruptions(page);
  if (interruption.kind) {
    const statusMap = {
      LOGIN: "PAUSED_FOR_LOGIN",
      MFA: "PAUSED_FOR_MFA",
      CAPTCHA: "PAUSED_FOR_CAPTCHA",
      ASSESSMENT: "PAUSED_FOR_ASSESSMENT",
      CHALLENGE_FRAME: "PAUSED_FOR_CAPTCHA",
    } as const;
    const eventMap = {
      LOGIN: "LOGIN_REQUIRED",
      MFA: "MFA_REQUIRED",
      CAPTCHA: "CAPTCHA_REQUIRED",
      ASSESSMENT: "ASSESSMENT_REQUIRED",
      CHALLENGE_FRAME: "CAPTCHA_REQUIRED",
    } as const;
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: {
        status: statusMap[interruption.kind],
        provider: detection.provider,
        currentUrl: page.url(),
        failureCode:
          interruption.kind === "LOGIN"
            ? "LOGIN_REQUIRED"
            : interruption.kind === "MFA"
              ? "MFA_REQUIRED"
              : interruption.kind === "ASSESSMENT"
                ? "ASSESSMENT_REQUIRED"
                : "CAPTCHA_REQUIRED",
        failureMessage: interruption.message,
        lastActivityAt: new Date(),
      },
    });
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: sessionId,
      type: eventMap[interruption.kind],
      message: interruption.message ?? "User action required in the application browser.",
    });
    return loadOwnedSession(userId, sessionId);
  }

  const snapshot = await adapter.inspect(page);
  snapshot.provider = detection.provider;
  const fingerprint = buildFormFingerprint(snapshot, row.jobPostingId);
  const previous = sessionJson(row);
  const answers: ResolvedApplicationAnswer[] = [];
  for (const field of snapshot.fields) {
    const existing = previous.plan.answers.find((item) => item.fieldId === field.externalId) ?? null;
    answers.push(
      await resolveApplicationAnswer({
        userId,
        field,
        resumeRevisionId: row.applicationPackage.resumeVersionRevisionId,
        jobPostingId: row.jobPostingId,
        existing,
      }),
    );
  }
  const plan: FillPlan = {
    answers,
    uploadedDocuments: previous.plan.uploadedDocuments,
    lockedCoverLetterRevisionId: previous.plan.lockedCoverLetterRevisionId ?? null,
  };
  const pending = pendingFromPlan(plan, snapshot.fields);
  const confirmedSubmit = adapterSupportsConfirmedSubmit(detection.provider, drifted) && Boolean(snapshot.submitControl?.isFinal);

  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: {
      provider: detection.provider,
      adapterVersion: ADAPTER_VERSION,
      executionMode: confirmedSubmit ? "CONFIRMED_BROWSER_SUBMIT" : "ASSISTED_BROWSER",
      currentUrl: page.url(),
      currentStep: snapshot.step,
      totalSteps: snapshot.totalSteps,
      formFingerprint: fingerprint,
      formSnapshotJson: toPrismaJson(snapshot),
      fillPlanJson: toPrismaJson(plan),
      pendingActionsJson: toPrismaJson(pending),
      warningsJson: toPrismaJson(
        drifted
          ? [{ code: "ADAPTER_DRIFT", message: "Dedicated adapter drifted. Using Generic. Confirmed submit is disabled." }]
          : previous.warnings,
      ),
      lastActivityAt: new Date(),
      status: pending.some((item) => item.kind === "UNSUPPORTED_WIDGET")
        ? "NEEDS_USER_INPUT"
        : pending.length > 0
          ? "NEEDS_USER_INPUT"
          : "READY_TO_FILL",
    },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "FORM_INSPECTED",
    message: `Inspected ${snapshot.fields.length} fields.`,
    metadata: { fieldCount: snapshot.fields.length, step: snapshot.step },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "FILL_PLAN_BUILT",
    message: "Fill plan built from CareerOS facts and current form inspection.",
  });

  if (options?.fillSafe) {
    await fillSafeFields(userId, sessionId);
  }
  return loadOwnedSession(userId, sessionId);
}

async function setStatus(sessionId: string, from: ApplicationExecutionStatus, to: ApplicationExecutionStatus) {
  if (from === to) return;
  assertTransition(from, to);
  await prisma.applicationExecutionSession.update({ where: { id: sessionId }, data: { status: to, lastActivityAt: new Date() } });
}

export async function fillSafeFields(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  if (row.status === "CANCELLED") throw Object.assign(new Error("Cannot fill from CANCELLED"), { code: "CONFLICT" });
  const runner = getApplicationBrowserRunner();
  const page = runner.getPage(sessionId);
  if (!page) {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "INTERRUPTED", failureCode: "BROWSER_CRASHED" },
    });
    throw Object.assign(new Error("BROWSER_CRASHED"), { code: "BROWSER_CRASHED" });
  }
  const { snapshot, plan } = sessionJson(row);
  if (!snapshot) return row;
  const drifted = row.warningsJson && JSON.stringify(row.warningsJson).includes("adapter-drift");
  const adapter = selectAdapter(row.provider, Boolean(drifted) || row.executionMode !== "CONFIRMED_BROWSER_SUBMIT" && row.provider === "GENERIC");
  await prisma.applicationExecutionSession.update({ where: { id: sessionId }, data: { status: "FILLING", lastActivityAt: new Date() } });

  for (const field of snapshot.fields) {
    const answer = plan.answers.find((item) => item.fieldId === field.externalId);
    if (!answer) continue;
    if (field.classification === "LEGAL" || field.classification === "SENSITIVE" || field.classification === "CONSENT") continue;
    if (answer.status !== "AUTO_FILL" || answer.value == null) continue;
    if (field.type === "FILE") continue;
    await adapter.fillField(page, field.selector.value, field.type, answer.value);
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: sessionId,
      type: "FIELD_FILLED",
      message: `Filled ${field.normalizedLabel}.`,
    });
  }

  for (const field of snapshot.fields) {
    if (field.type !== "FILE" || !field.documentKind) continue;
    if (field.documentKind === "resume") {
      const { resolveResumeArtifact } = await import("../documents/resolve-resume-artifact");
      if (!row.applicationPackage.resumeVersionRevisionId) continue;
      const artifact = await resolveResumeArtifact({
        userId,
        resumeVersionRevisionId: row.applicationPackage.resumeVersionRevisionId,
      });
      try {
        await withBoundedRetry(() =>
          adapter.uploadAsset(page, field.selector.value, {
            filePath: artifact.filePath,
            fileName: artifact.fileName,
            mimeType: artifact.mimeType,
          }),
        );
      } catch (lastError) {
        await prisma.applicationExecutionSession.update({
          where: { id: sessionId },
          data: { status: "BLOCKED", failureCode: "RESUME_UPLOAD_FAILED", failureMessage: "Exact resume upload failed." },
        });
        throw lastError;
      }
      plan.uploadedDocuments = plan.uploadedDocuments.filter((item) => item.kind !== "resume");
      plan.uploadedDocuments.push({
        fieldId: field.externalId,
        kind: "resume",
        revisionId: artifact.revisionId,
        fileHash: artifact.fileHash,
        fileName: artifact.fileName,
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "FILE_UPLOADED",
        message: "Exact approved resume revision uploaded.",
        metadata: { revisionId: artifact.revisionId, fileHash: artifact.fileHash },
      });
    }
    if (field.documentKind === "cover_letter" && row.applicationPackage.coverLetterDraftId) {
      const { resolveCoverLetterArtifact } = await import("../documents/resolve-cover-letter-artifact");
      const artifact = await resolveCoverLetterArtifact({
        userId,
        coverLetterDraftId: row.applicationPackage.coverLetterDraftId,
        lockedRevisionId: row.applicationPackage.coverLetterRevisionId ?? plan.lockedCoverLetterRevisionId,
      });
      await withBoundedRetry(() =>
        adapter.uploadAsset(page, field.selector.value, {
          filePath: artifact.filePath,
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
        }),
      );
      plan.uploadedDocuments = plan.uploadedDocuments.filter((item) => item.kind !== "cover_letter");
      plan.uploadedDocuments.push({
        fieldId: field.externalId,
        kind: "cover_letter",
        revisionId: artifact.revisionId,
        fileHash: artifact.fileHash,
        fileName: artifact.fileName,
      });
      await recordExecutionEvent(prisma, {
        userId,
        executionSessionId: sessionId,
        type: "FILE_UPLOADED",
        message: "Exact approved cover letter revision uploaded.",
        metadata: { revisionId: artifact.revisionId, fileHash: artifact.fileHash },
      });
    }
  }

  const pending = pendingFromPlan(plan, snapshot.fields);
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: {
      fillPlanJson: toPrismaJson(plan),
      pendingActionsJson: toPrismaJson(pending),
      status: pending.length > 0 ? "NEEDS_USER_INPUT" : snapshot.submitControl ? "READY_FOR_REVIEW" : "READY_TO_FILL",
      lastActivityAt: new Date(),
    },
  });
  return loadOwnedSession(userId, sessionId);
}
