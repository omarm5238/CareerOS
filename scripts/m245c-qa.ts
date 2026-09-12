import "dotenv/config";

process.env.CAREEROS_BROWSER_HEADLESS = "1";
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.USERPROFILE) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = `${process.env.USERPROFILE}\\AppData\\Local\\ms-playwright`;
}

import { prisma } from "@/server/db/prisma";
import { EMPTY_RESUME_VERSION_CONTENT } from "@/features/resume/versions/types";
import { toPrismaJson } from "@/features/application-execution/lib/json-parsers";
import { startFixtureServer, FIXTURE_ORIGIN } from "@/features/application-execution/fixtures/server";
import {
  cancelExecutionSession,
  closeAllBrowserRuntimes,
  createExecutionSession,
  executeConfirmedSubmit,
  fillSafeFields,
  generateFieldAnswer,
  getExecutionSession,
  grantSubmissionApproval,
  inspectAndPlan,
  patchFieldAnswer,
  startExecutionSession,
  verifySubmission,
} from "@/features/application-execution/server";
import { ExecutionAccessError } from "@/features/application-execution/lib/permissions";
import { getApplicationBrowserRunner } from "@/features/application-execution/browser/browser-runtime-registry";
import { loadOwnedSession, sessionJson } from "@/features/application-execution/sessions/load-owned-session";
import { reviewExecutionSession } from "@/features/application-execution/submission/review-execution-session";
import { classifyPageActions, type RawPageAction } from "@/features/application-execution/classification/classify-application-action";
import { computeRuntimeSubmissionCapability } from "@/features/application-execution/submission/runtime-submission-capability";
import { isConfirmedSubmitEnabledForProvider } from "@/features/application-execution/adapters/confirmed-submit-policy";
import {
  clearProviderEligibilityOverridesForTests,
  setProviderEligibilityOverrideForTests,
} from "@/features/application-execution/adapters/provider-submission-capabilities";
import { genericAdapter } from "@/features/application-execution/adapters/adapter-registry";
import { greenhouseAdapter } from "@/features/application-execution/adapters/greenhouse";
import type { ApplicationFormSnapshot } from "@/features/application-execution/types";
import { buildFinalSubmissionSnapshot } from "@/features/application-execution/submission/build-final-submission-snapshot";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function rawAction(partial: Partial<RawPageAction> & { label: string }): RawPageAction {
  return {
    selector: partial.selector ?? `[data-qa="${partial.label}"]`,
    label: partial.label,
    type: partial.type ?? "button",
    insideForm: partial.insideForm ?? false,
    formHasFields: partial.formHasFields ?? false,
    isSubmitType: partial.isSubmitType ?? false,
    dataOpen: partial.dataOpen ?? false,
    dataNext: partial.dataNext ?? false,
    dataFinal: partial.dataFinal ?? false,
    dataCancel: partial.dataCancel ?? false,
  };
}

async function getTestUser() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  return user;
}

async function createPackage(input: { userId: string; jobUrl: string; title: string }) {
  const existingResume = await prisma.resumeVersion.findFirst({
    where: { userId: input.userId },
    include: { revisions: { orderBy: { revisionNumber: "asc" } } },
  });
  const version =
    existingResume ??
    (await prisma.resumeVersion.create({
      data: {
        userId: input.userId,
        title: "M245C Resume",
        type: "JOB_SPECIFIC",
        status: "READY",
        revisions: {
          create: {
            userId: input.userId,
            revisionNumber: 1,
            source: "USER_EDITED",
            contentJson: toPrismaJson({
              ...EMPTY_RESUME_VERSION_CONTENT,
              summary: "Backend engineer. github.com/example-user",
              coreSkills: ["TypeScript"],
            }),
            keywordCoverageJson: toPrismaJson([]),
            warningsJson: toPrismaJson([]),
            changeLogJson: toPrismaJson([]),
            evidenceNotesJson: toPrismaJson([]),
            inputSnapshotJson: toPrismaJson({}),
          },
        },
      },
      include: { revisions: true },
    }));
  const revisionA = version.revisions[0]!;
  await prisma.resumeVersion.update({
    where: { id: version.id },
    data: { activeRevisionId: revisionA.id, status: "READY" },
  });
  const cover = await prisma.communicationDraft.create({
    data: {
      userId: input.userId,
      type: "COVER_LETTER",
      status: "READY",
      revisions: {
        create: {
          userId: input.userId,
          revisionNumber: 1,
          source: "USER_EDITED",
          content: "Cover letter revision for M24.5C.",
          tone: "PROFESSIONAL",
          length: "STANDARD",
          language: "ENGLISH",
          contextSnapshotJson: toPrismaJson({}),
          contextFingerprint: `m245c-${Date.now()}`,
        },
      },
    },
    include: { revisions: true },
  });
  await prisma.communicationDraft.update({
    where: { id: cover.id },
    data: { activeRevisionId: cover.revisions[0]!.id },
  });
  const job = await prisma.jobPosting.create({
    data: {
      userId: input.userId,
      title: input.title,
      company: "Fixture Corp",
      description: "Backend Software Engineer role for CareerOS execution fixtures.",
      jobUrl: input.jobUrl,
      source: "m245c-fixture",
    },
  });
  const application = await prisma.application.create({
    data: {
      userId: input.userId,
      jobPostingId: job.id,
      status: "DRAFT",
      source: "JOBS_MODULE",
      resumeVersionId: version.id,
      resumeVersionRevisionId: revisionA.id,
      contextSnapshotJson: toPrismaJson({ title: job.title }),
    },
  });
  const pkg = await prisma.applicationPackage.create({
    data: {
      userId: input.userId,
      jobPostingId: job.id,
      applicationId: application.id,
      version: 1,
      resumeVersionId: version.id,
      resumeVersionRevisionId: revisionA.id,
      coverLetterDraftId: cover.id,
      coverLetterRevisionId: cover.revisions[0]!.id,
      status: "APPROVED",
      readinessStatus: "READY",
      qaStatus: "PASS",
      contextFingerprint: `m245c-${job.id}`,
      approvedAt: new Date(),
    },
  });
  return { job, application, pkg, revisionA, cover, version };
}

async function confirmRequired(userId: string, sessionId: string) {
  const view = await getExecutionSession(userId, sessionId);
  for (const field of view.fields) {
    if (field.classification === "LEGAL") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "yes", confirmed: true });
    } else if (field.classification === "CONSENT") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "true", confirmed: true });
    } else if (field.classification === "FREE_TEXT") {
      await generateFieldAnswer(userId, sessionId, field.id);
      const after = await getExecutionSession(userId, sessionId);
      const current = after.fields.find((item) => item.id === field.id);
      await patchFieldAnswer(userId, sessionId, field.id, {
        value: current?.proposedValue || "I am interested based on the provided resume facts.",
        confirmed: true,
        reviewed: true,
      });
    } else if (field.classification === "SENSITIVE") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "decline", confirmed: true });
    } else if (field.required && field.status === "NEEDS_INPUT") {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "search", confirmed: true });
    } else if (field.classification === "CONTACT" && /phone/i.test(field.label)) {
      await patchFieldAnswer(userId, sessionId, field.id, { value: "+49111111111", confirmed: true });
    }
  }
}

const FLAG_KEYS = [
  "CAREEROS_CONFIRMED_BROWSER_SUBMIT",
  "CAREEROS_SUBMIT_GREENHOUSE",
  "CAREEROS_SUBMIT_LEVER",
  "CAREEROS_SUBMIT_ASHBY",
  "CAREEROS_SUBMIT_WORKABLE",
  "CAREEROS_SUBMIT_SMARTRECRUITERS",
] as const;

const savedFlags: Record<string, string | undefined> = {};

function snapshotFlags() {
  for (const key of FLAG_KEYS) savedFlags[key] = process.env[key];
}

function restoreFlags() {
  for (const key of FLAG_KEYS) {
    const value = savedFlags[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  clearProviderEligibilityOverridesForTests();
}

function enableThreeKeyGreenhouse() {
  process.env.CAREEROS_CONFIRMED_BROWSER_SUBMIT = "1";
  process.env.CAREEROS_SUBMIT_GREENHOUSE = "1";
  setProviderEligibilityOverrideForTests("GREENHOUSE", true);
}

function fakeSnapshot(): ApplicationFormSnapshot {
  return {
    provider: "GREENHOUSE",
    pageUrl: "http://127.0.0.1/greenhouse",
    step: 1,
    totalSteps: 1,
    fields: [
      {
        externalId: "first",
        selector: { strategy: "css", value: "[name=first]" },
        label: "First name",
        normalizedLabel: "first name",
        type: "TEXT",
        required: true,
        options: [],
        step: 1,
        classification: "IDENTITY",
        confidence: 0.99,
        currentValueState: "filled",
        currentValuePreview: "Ada",
        documentKind: null,
      },
      {
        externalId: "email",
        selector: { strategy: "css", value: "[name=email]" },
        label: "Email",
        normalizedLabel: "email",
        type: "EMAIL",
        required: true,
        options: [],
        step: 1,
        classification: "CONTACT",
        confidence: 0.99,
        currentValueState: "filled",
        currentValuePreview: "a@b.c",
        documentKind: null,
      },
      {
        externalId: "resume",
        selector: { strategy: "css", value: "[name=resume]" },
        label: "Resume",
        normalizedLabel: "resume",
        type: "FILE",
        required: true,
        options: [],
        step: 1,
        classification: "DOCUMENT",
        confidence: 0.99,
        currentValueState: "empty",
        currentValuePreview: null,
        documentKind: "resume",
      },
    ],
    submitControl: { selector: { strategy: "css", value: "[data-careeros-final-submit='true']" }, label: "Submit application", isFinal: true, confidence: 0.99 },
    nextControl: null,
    openApplicationControl: null,
    actions: [
      {
        action: "FINAL_SUBMIT",
        confidence: 0.99,
        trusted: true,
        reasons: ["data-careeros-final-submit"],
        selector: { strategy: "css", value: "[data-careeros-final-submit='true']" },
        label: "Submit application",
      },
    ],
    inspectedAt: new Date().toISOString(),
  };
}

async function prepareGreenhouseSession(userId: string, title: string, url = `${FIXTURE_ORIGIN}/greenhouse`) {
  const pack = await createPackage({ userId, jobUrl: url, title });
  const created = await createExecutionSession(userId, pack.pkg.id);
  await startExecutionSession(userId, created.sessionId);
  await confirmRequired(userId, created.sessionId);
  await fillSafeFields(userId, created.sessionId);
  await reviewExecutionSession(userId, created.sessionId);
  return { ...pack, sessionId: created.sessionId };
}

async function run() {
  snapshotFlags();
  restoreFlags();
  const fixtures = await startFixtureServer();
  const user = await getTestUser();
  evidence.testUserId = user.id;
  await prisma.applicationExecutionSession.updateMany({
    where: { userId: user.id, status: { notIn: ["SUBMITTED", "CANCELLED", "FAILED", "BLOCKED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  try {
    const actions = classifyPageActions([
      rawAction({ label: "Apply", dataOpen: true }),
      rawAction({ label: "I'm interested", dataOpen: true }),
      rawAction({ label: "Continue", dataNext: true, insideForm: true, formHasFields: true }),
      rawAction({ label: "Save & Continue", dataNext: true, insideForm: true, formHasFields: true }),
      rawAction({ label: "Review", insideForm: true, formHasFields: true }),
      rawAction({ label: "Submit application", dataFinal: true, isSubmitType: true, insideForm: true, formHasFields: true }),
      rawAction({ label: "Cancel", dataCancel: true }),
    ]);
    const byLabel = Object.fromEntries(actions.map((item) => [item.label, item.action]));
    evidence.actionClassification = byLabel;
    assert(byLabel.Apply === "OPEN_APPLICATION", "Apply must be OPEN_APPLICATION");
    assert(byLabel["I'm interested"] === "OPEN_APPLICATION", "I'm interested must be OPEN_APPLICATION");
    assert(byLabel.Continue === "NEXT_STEP", "Continue must be NEXT_STEP");
    assert(byLabel["Save & Continue"] === "SAVE_AND_CONTINUE", "Save & Continue must be SAVE_AND_CONTINUE");
    assert(byLabel.Review === "UNKNOWN", "Review must remain UNKNOWN");
    assert(byLabel["Submit application"] === "FINAL_SUBMIT", "Submit application must be FINAL_SUBMIT");
    assert(byLabel.Cancel === "CANCEL", "Cancel must be CANCEL");
    const final = actions.find((item) => item.action === "FINAL_SUBMIT");
    assert(final?.trusted === true, "Only true FINAL_SUBMIT may be trusted");
    assert(actions.find((item) => item.label === "Apply")?.action !== "FINAL_SUBMIT", "Apply must not be FINAL_SUBMIT");

    process.env.CAREEROS_CONFIRMED_BROWSER_SUBMIT = "";
    process.env.CAREEROS_SUBMIT_GREENHOUSE = "1";
    process.env.CAREEROS_SUBMIT_LEVER = "1";
    process.env.CAREEROS_SUBMIT_ASHBY = "1";
    process.env.CAREEROS_SUBMIT_WORKABLE = "1";
    process.env.CAREEROS_SUBMIT_SMARTRECRUITERS = "1";
    setProviderEligibilityOverrideForTests("GREENHOUSE", true);
    evidence.globalKillSwitch = isConfirmedSubmitEnabledForProvider("GREENHOUSE") === false;
    assert(evidence.globalKillSwitch, "Global switch off must disable confirmed submit");

    process.env.CAREEROS_CONFIRMED_BROWSER_SUBMIT = "1";
    delete process.env.CAREEROS_SUBMIT_GREENHOUSE;
    setProviderEligibilityOverrideForTests("GREENHOUSE", true);
    evidence.providerKillSwitch = isConfirmedSubmitEnabledForProvider("GREENHOUSE") === false;
    assert(evidence.providerKillSwitch, "Provider switch off must disable confirmed submit");

    enableThreeKeyGreenhouse();
    const ambiguous = computeRuntimeSubmissionCapability({
      provider: "GREENHOUSE",
      detection: { confidence: 0.99, drifted: false, cautious: false },
      snapshot: fakeSnapshot(),
      actions: [
        { action: "FINAL_SUBMIT", confidence: 0.5, trusted: false, reasons: ["ambiguous"], selector: { strategy: "css", value: "button" }, label: "Submit" },
      ],
      interruption: null,
      drifted: false,
      unsupportedWidget: false,
      formFingerprintStable: true,
      reviewComplete: true,
    });
    evidence.runtimeTrustAmbiguous = ambiguous.confirmedBrowserSubmit === false;
    assert(ambiguous.confirmedBrowserSubmit === false, "Ambiguous submit control must keep runtime confirmed submit false");

    evidence.genericNeverConfirmed = genericAdapter().capabilities().confirmedBrowserSubmit === false;
    process.env.CAREEROS_CONFIRMED_BROWSER_SUBMIT = "1";
    process.env.CAREEROS_SUBMIT_GREENHOUSE = "1";
    evidence.genericIgnoresFlags = genericAdapter().capabilities().confirmedBrowserSubmit === false;
    assert(evidence.genericIgnoresFlags, "Generic cannot confirmed-submit even with flags");
    evidence.genericPolicy = isConfirmedSubmitEnabledForProvider("GENERIC") === false;

    enableThreeKeyGreenhouse();
    const trustedRuntime = computeRuntimeSubmissionCapability({
      provider: "GREENHOUSE",
      detection: { confidence: 0.99, drifted: false, cautious: false },
      snapshot: fakeSnapshot(),
      actions: fakeSnapshot().actions,
      interruption: null,
      drifted: false,
      unsupportedWidget: false,
      formFingerprintStable: true,
      reviewComplete: true,
    });
    evidence.threeKeyPositiveUnit = trustedRuntime.confirmedBrowserSubmit === true;
    assert(trustedRuntime.confirmedBrowserSubmit, "Three-key trusted fixture runtime must be true");

    const ashby = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/ashby?variant=open`,
      title: "M245C Ashby open",
    });
    const ashbySession = await createExecutionSession(user.id, ashby.pkg.id);
    const attemptsBeforeAshby = await prisma.applicationSubmissionAttempt.count({ where: { userId: user.id, executionSessionId: ashbySession.sessionId } });
    await startExecutionSession(user.id, ashbySession.sessionId);
    const ashbyView = await getExecutionSession(user.id, ashbySession.sessionId);
    const ashbyAttempts = await prisma.applicationSubmissionAttempt.count({ where: { userId: user.id, executionSessionId: ashbySession.sessionId } });
    const ashbyEvents = await prisma.applicationEvent.count({ where: { applicationId: ashby.application.id } });
    evidence.ashbyOpenProvider = ashbyView.provider;
    evidence.ashbyOpenFields = ashbyView.fields.length;
    evidence.ashbyOpenAttempts = ashbyAttempts - attemptsBeforeAshby;
    evidence.ashbyOpenM22Events = ashbyEvents;
    assert(ashbyView.fields.length >= 3, "Ashby OPEN_APPLICATION should reach the form");
    assert(ashbyAttempts === 0, "OPEN_APPLICATION must not create a SubmissionAttempt");
    assert(ashbyEvents === 0, "OPEN_APPLICATION must not create an M22 application event");
    await cancelExecutionSession(user.id, ashbySession.sessionId);

    const sr = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/smartrecruiters?variant=open`,
      title: "M245C SR open",
    });
    const srSession = await createExecutionSession(user.id, sr.pkg.id);
    await startExecutionSession(user.id, srSession.sessionId);
    const srView = await getExecutionSession(user.id, srSession.sessionId);
    const srAttempts = await prisma.applicationSubmissionAttempt.count({ where: { executionSessionId: srSession.sessionId } });
    evidence.srOpenProvider = srView.provider;
    evidence.srOpenFields = srView.fields.length;
    evidence.srOpenAttempts = srAttempts;
    assert(srView.fields.length >= 3, "SmartRecruiters OPEN_APPLICATION should reach the form");
    assert(srAttempts === 0, "SR OPEN_APPLICATION must not create a SubmissionAttempt");
    await cancelExecutionSession(user.id, srSession.sessionId);

    const finalStep = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?variant=final-step`,
      title: "M245C final step",
    });
    const finalSession = await createExecutionSession(user.id, finalStep.pkg.id);
    await startExecutionSession(user.id, finalSession.sessionId);
    const finalRow = await loadOwnedSession(user.id, finalSession.sessionId);
    const finalSnapshot = sessionJson(finalRow).snapshot;
    const finalActions = finalSnapshot?.actions ?? [];
    evidence.finalStepActions = finalActions.map((item) => ({ label: item.label, action: item.action, trusted: item.trusted }));
    const trustedFinal = finalActions.filter((item) => item.action === "FINAL_SUBMIT" && item.trusted);
    assert(trustedFinal.length === 1, "Only Submit application is trusted FINAL_SUBMIT");
    assert(finalActions.find((item) => item.label === "Continue")?.action === "NEXT_STEP", "Continue is NEXT_STEP");
    assert(finalActions.find((item) => item.label === "Review")?.trusted !== true, "Review must not be trusted final submit");
    await cancelExecutionSession(user.id, finalSession.sessionId);

    enableThreeKeyGreenhouse();
    const trusted = await prepareGreenhouseSession(user.id, "M245C three-key positive");
    const trustedView = await getExecutionSession(user.id, trusted.sessionId);
    evidence.threeKeyPositiveRuntime = trustedView.submission.runtimeCapability;
    evidence.threeKeyPositiveAvailable = trustedView.submission.confirmedBrowserSubmitAvailable;
    evidence.threeKeyPositiveStatus = trustedView.status;
    evidence.threeKeyPositivePending = trustedView.pendingActions;
    assert(trustedView.submission.runtimeCapability?.confirmedBrowserSubmit === true, "Fixture three-key runtime must be true");
    const approval = await grantSubmissionApproval(user.id, trusted.sessionId);
    evidence.finalSubmitCreatesAttempt = Boolean(approval.attemptId);
    await executeConfirmedSubmit(user.id, trusted.sessionId, approval.attemptId, approval.approvalToken);
    const verifiedView = await getExecutionSession(user.id, trusted.sessionId);
    evidence.verifiedStatus = verifiedView.submission.verificationStatus;
    evidence.verifiedM22 = verifiedView.applicationStatus;
    assert(verifiedView.submission.verificationStatus === "VERIFIED", "Dedicated fixture submit should VERIFIED");
    assert(verifiedView.applicationStatus === "APPLIED", "VERIFIED may mark APPLIED via existing M22 transition");

    const probablePack = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic?variant=probable`,
      title: "M245C probable",
    });
    const probableSession = await createExecutionSession(user.id, probablePack.pkg.id);
    await startExecutionSession(user.id, probableSession.sessionId);
    const probableResult = await genericAdapter().verifySubmission(getApplicationBrowserRunner().getPage(probableSession.sessionId)!);
    evidence.probableStatus = probableResult.status;
    const probableApp = await prisma.application.findUnique({ where: { id: probablePack.application.id } });
    evidence.probableRemainsDraft = probableApp?.status === "DRAFT";
    assert(probableResult.status === "PROBABLE", "Generic thank-you is PROBABLE");
    assert(probableApp?.status === "DRAFT", "PROBABLE must not auto APPLIED");
    await cancelExecutionSession(user.id, probableSession.sessionId);

    const unverifiedPack = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic?variant=unverified`,
      title: "M245C unverified",
    });
    const unverifiedSession = await createExecutionSession(user.id, unverifiedPack.pkg.id);
    await startExecutionSession(user.id, unverifiedSession.sessionId);
    const unverifiedResult = await genericAdapter().verifySubmission(getApplicationBrowserRunner().getPage(unverifiedSession.sessionId)!);
    const unverifiedApp = await prisma.application.findUnique({ where: { id: unverifiedPack.application.id } });
    evidence.unverifiedStatus = unverifiedResult.status;
    evidence.unverifiedRemainsDraft = unverifiedApp?.status === "DRAFT";
    assert(unverifiedResult.status === "UNVERIFIED", "Ambiguous page is UNVERIFIED");
    assert(unverifiedApp?.status === "DRAFT", "UNVERIFIED must not auto APPLIED");
    await cancelExecutionSession(user.id, unverifiedSession.sessionId);

    const wrongPack = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?variant=wrong-success`,
      title: "M245C wrong marker",
    });
    const wrongSession = await createExecutionSession(user.id, wrongPack.pkg.id);
    await startExecutionSession(user.id, wrongSession.sessionId);
    const wrongResult = await greenhouseAdapter.verifySubmission(getApplicationBrowserRunner().getPage(wrongSession.sessionId)!);
    evidence.wrongMarkerStatus = wrongResult.status;
    const wrongApp = await prisma.application.findUnique({ where: { id: wrongPack.application.id } });
    evidence.wrongMarkerRemainsDraft = wrongApp?.status === "DRAFT";
    assert(wrongResult.status !== "VERIFIED", "Foreign success marker must not be VERIFIED");
    await cancelExecutionSession(user.id, wrongSession.sessionId);

    const dupPack = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?variant=duplicate`,
      title: "M245C duplicate",
    });
    const dupSession = await createExecutionSession(user.id, dupPack.pkg.id);
    await startExecutionSession(user.id, dupSession.sessionId);
    const dupView = await getExecutionSession(user.id, dupSession.sessionId);
    const dupApp = await prisma.application.findUnique({ where: { id: dupPack.application.id } });
    evidence.duplicateFailure = dupView.failureCode;
    evidence.duplicateStatus = dupView.status;
    evidence.duplicateRemainsDraft = dupApp?.status === "DRAFT";
    assert(dupView.failureCode === "DUPLICATE_APPLICATION", "Duplicate provider copy must map to DUPLICATE_APPLICATION");
    assert(dupApp?.status === "DRAFT", "Duplicate must not mark APPLIED");
    let dupGrantBlocked = false;
    try {
      await grantSubmissionApproval(user.id, dupSession.sessionId);
    } catch {
      dupGrantBlocked = true;
    }
    evidence.duplicateGrantBlocked = dupGrantBlocked;
    await cancelExecutionSession(user.id, dupSession.sessionId).catch(() => undefined);

    const closedPack = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?variant=closed`,
      title: "M245C job closed",
    });
    const closedSession = await createExecutionSession(user.id, closedPack.pkg.id);
    await startExecutionSession(user.id, closedSession.sessionId);
    const closedView = await getExecutionSession(user.id, closedSession.sessionId);
    const closedApp = await prisma.application.findUnique({ where: { id: closedPack.application.id } });
    evidence.jobClosedFailure = closedView.failureCode;
    evidence.jobClosedRemainsDraft = closedApp?.status === "DRAFT";
    assert(closedView.failureCode === "JOB_CLOSED", "Closed job must be JOB_CLOSED");
    assert(closedApp?.status === "DRAFT", "Closed job must remain non-APPLIED");
    let closedGrantBlocked = false;
    try {
      await grantSubmissionApproval(user.id, closedSession.sessionId);
    } catch {
      closedGrantBlocked = true;
    }
    evidence.jobClosedGrantBlocked = closedGrantBlocked;
    await cancelExecutionSession(user.id, closedSession.sessionId).catch(() => undefined);

    enableThreeKeyGreenhouse();
    const mutate = await prepareGreenhouseSession(user.id, "M245C form mutation");
    const mutateApproval = await grantSubmissionApproval(user.id, mutate.sessionId);
    const mutatePage = getApplicationBrowserRunner().getPage(mutate.sessionId);
    await mutatePage?.evaluate(() => {
      const form = document.querySelector("form");
      const label = document.createElement("label");
      label.textContent = "New required question ";
      const input = document.createElement("input");
      input.name = "gh_new_required";
      input.required = true;
      label.appendChild(input);
      form?.prepend(label);
    });
    let mutationBlocked = false;
    try {
      await executeConfirmedSubmit(user.id, mutate.sessionId, mutateApproval.attemptId, mutateApproval.approvalToken);
    } catch {
      mutationBlocked = true;
    }
    const mutateAfter = await getExecutionSession(user.id, mutate.sessionId);
    evidence.formMutationBlocked = mutationBlocked;
    evidence.formMutationStatus = mutateAfter.status;
    evidence.formMutationApp = mutateAfter.applicationStatus;
    assert(mutationBlocked, "Form mutation must invalidate approval and block submit");
    assert(mutateAfter.applicationStatus === "DRAFT", "Mutation must keep application DRAFT");
    await cancelExecutionSession(user.id, mutate.sessionId).catch(() => undefined);

    enableThreeKeyGreenhouse();
    const manual = await prepareGreenhouseSession(user.id, "M245C manual value");
    const firstName = (await getExecutionSession(user.id, manual.sessionId)).fields.find((field) => /first name/i.test(field.label));
    const afterManualRow = await loadOwnedSession(user.id, manual.sessionId);
    const firstSelector = sessionJson(afterManualRow).snapshot?.fields.find((item) => item.externalId === firstName?.id)?.selector.value;
    const manualPage = getApplicationBrowserRunner().getPage(manual.sessionId);
    assert(firstSelector, "First name selector required");
    await manualPage?.fill(firstSelector!, "ManualAda");
    await inspectAndPlan(user.id, manual.sessionId, { navigate: false, fillSafe: false });
    const afterManual = await loadOwnedSession(user.id, manual.sessionId);
    const manualPlan = sessionJson(afterManual);
    const liveAnswer = manualPlan.plan.answers.find((item) => item.fieldId === firstName?.id);
    const liveField = manualPlan.snapshot?.fields.find((item) => item.externalId === firstName?.id);
    evidence.manualLivePreview = liveField?.currentValuePreview;
    evidence.manualPlanValue = liveAnswer?.value;
    assert(liveField?.currentValuePreview === "ManualAda", "Reinspect must detect the actual browser value");
    const manualSnapshot = buildFinalSubmissionSnapshot(afterManual, manualPlan.snapshot!, manualPlan.plan);
    evidence.manualSnapshotUsesLive = Boolean(manualSnapshot.fields.find((item) => item.fieldId === firstName?.id));
    await cancelExecutionSession(user.id, manual.sessionId);

    enableThreeKeyGreenhouse();
    const legal = await prepareGreenhouseSession(user.id, "M245C legal manual");
    const legalField = (await getExecutionSession(user.id, legal.sessionId)).fields.find((field) => field.classification === "LEGAL");
    const legalRow = await loadOwnedSession(user.id, legal.sessionId);
    const legalSelector = sessionJson(legalRow).snapshot?.fields.find((item) => item.externalId === legalField?.id)?.selector.value;
    const legalPage = getApplicationBrowserRunner().getPage(legal.sessionId);
    assert(legalSelector, "Legal selector required");
    await legalPage?.selectOption(legalSelector!, "no");
    await inspectAndPlan(user.id, legal.sessionId, { navigate: false, fillSafe: false });
    const legalView = await getExecutionSession(user.id, legal.sessionId);
    const legalAfter = legalView.fields.find((field) => field.id === legalField?.id);
    evidence.legalConfirmedAfterManual = legalAfter?.confirmed;
    evidence.legalStatusAfterManual = legalAfter?.status;
    assert(legalAfter?.confirmed === false, "Manual legal change must require explicit confirmation");
    let legalGrantBlocked = false;
    try {
      await grantSubmissionApproval(user.id, legal.sessionId);
    } catch {
      legalGrantBlocked = true;
    }
    evidence.legalGrantBlocked = legalGrantBlocked;
    assert(legalGrantBlocked, "Unconfirmed current legal value must block approval");
    await cancelExecutionSession(user.id, legal.sessionId);

    enableThreeKeyGreenhouse();
    const captcha = await prepareGreenhouseSession(user.id, "M245C captcha");
    const captchaPage = getApplicationBrowserRunner().getPage(captcha.sessionId);
    await captchaPage?.evaluate(() => {
      const recaptcha = document.createElement("div");
      recaptcha.className = "g-recaptcha";
      recaptcha.setAttribute("data-careeros-captcha", "true");
      document.body.appendChild(recaptcha);
    });
    let captchaBlocked = false;
    let captchaMessage = "";
    try {
      await grantSubmissionApproval(user.id, captcha.sessionId);
    } catch (error) {
      captchaBlocked = true;
      captchaMessage = error instanceof ExecutionAccessError || error instanceof Error ? error.message : String(error);
    }
    const captchaView = await getExecutionSession(user.id, captcha.sessionId);
    evidence.captchaBlocked = captchaBlocked;
    evidence.captchaStatus = captchaView.status;
    evidence.captchaMessage = captchaMessage;
    assert(captchaBlocked, "CAPTCHA before submit must not grant approval");
    assert(captchaView.status === "PAUSED_FOR_CAPTCHA", "CAPTCHA must pause the session");
    await cancelExecutionSession(user.id, captcha.sessionId);

    enableThreeKeyGreenhouse();
    const downgrade = await prepareGreenhouseSession(user.id, "M245C downgrade");
    const beforeDrift = await getExecutionSession(user.id, downgrade.sessionId);
    evidence.downgradeBefore = beforeDrift.submission.runtimeCapability?.confirmedBrowserSubmit;
    const driftPage = getApplicationBrowserRunner().getPage(downgrade.sessionId);
    await driftPage?.evaluate(() => {
      document.querySelector("form")?.removeAttribute("id");
      document.querySelector("form")?.removeAttribute("data-ats");
      document.querySelector("form")?.setAttribute("data-ats", "generic");
    });
    await inspectAndPlan(user.id, downgrade.sessionId, { navigate: false, fillSafe: false });
    const afterDrift = await getExecutionSession(user.id, downgrade.sessionId);
    evidence.downgradeAfter = afterDrift.submission.runtimeCapability?.confirmedBrowserSubmit;
    evidence.downgradeAssisted = afterDrift.executionMode;
    evidence.downgradeProvider = afterDrift.provider;
    assert(evidence.downgradeBefore === true, "Session starts runtime-trusted");
    assert(afterDrift.submission.runtimeCapability?.confirmedBrowserSubmit === false, "Drift must downgrade confirmed submit");
    assert(afterDrift.fields.length > 0, "Assisted inspection remains available after downgrade");
    await cancelExecutionSession(user.id, downgrade.sessionId);

    const userB = await prisma.user.findFirst({ where: { email: { not: user.email } } });
    if (userB) {
      enableThreeKeyGreenhouse();
      const owned = await prepareGreenhouseSession(user.id, "M245C security");
      let cross = false;
      try {
        await getExecutionSession(userB.id, owned.sessionId);
      } catch {
        cross = true;
      }
      evidence.crossUserBlocked = cross;
      assert(cross, "User B must not inspect User A session");
      await cancelExecutionSession(user.id, owned.sessionId);
    } else {
      evidence.crossUserBlocked = "no-second-user";
    }

    restoreFlags();
    evidence.envRestored = true;
    evidence.ok = true;
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    restoreFlags();
    await closeAllBrowserRuntimes();
    await fixtures.close();
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
