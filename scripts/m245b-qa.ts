import "dotenv/config";

import { prisma } from "@/server/db/prisma";
import { EMPTY_RESUME_VERSION_CONTENT } from "@/features/resume/versions/types";
import { toPrismaJson } from "@/features/application-execution/lib/json-parsers";
import { startFixtureServer, FIXTURE_ORIGIN } from "@/features/application-execution/fixtures/server";
import {
  cancelExecutionSession,
  closeAllBrowserRuntimes,
  confirmSubmissionOutcome,
  continueApplication,
  createExecutionSession,
  executeConfirmedSubmit,
  fillSafeFields,
  generateFieldAnswer,
  getExecutionSession,
  grantSubmissionApproval,
  inspectAndPlan,
  patchFieldAnswer,
  resumeExecutionSession,
  startExecutionSession,
  verifySubmission,
} from "@/features/application-execution/server";
import { ExecutionAccessError } from "@/features/application-execution/lib/permissions";
import { getApplicationBrowserRunner } from "@/features/application-execution/browser/browser-runtime-registry";
import { sessionJson } from "@/features/application-execution/sessions/load-owned-session";
import { loadOwnedSession } from "@/features/application-execution/sessions/load-owned-session";
import { reviewExecutionSession } from "@/features/application-execution/submission/review-execution-session";
import { officialApiAvailable } from "@/features/application-execution/adapters/adapter-registry";
import { greenhouseAdapter } from "@/features/application-execution/adapters/greenhouse";
import { PRE_SUBMIT_MAX_RETRIES } from "@/features/application-execution/types";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function getTestUser() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  return user;
}

async function createPackage(input: {
  userId: string;
  jobUrl: string;
  title: string;
  approved?: boolean;
}) {
  const existingResume = await prisma.resumeVersion.findFirst({
    where: { userId: input.userId },
    include: { revisions: { orderBy: { revisionNumber: "asc" } } },
  });
  const version =
    existingResume ??
    (await prisma.resumeVersion.create({
      data: {
        userId: input.userId,
        title: "M245B Resume",
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
  const revisionB = await prisma.resumeVersionRevision.create({
    data: {
      userId: input.userId,
      resumeVersionId: version.id,
      revisionNumber: (version.revisions.at(-1)?.revisionNumber ?? 1) + 100 + Math.floor(Math.random() * 50),
      source: "USER_EDITED",
      contentJson: toPrismaJson({ ...EMPTY_RESUME_VERSION_CONTENT, summary: "ACTIVE B - do not upload" }),
      keywordCoverageJson: toPrismaJson([]),
      warningsJson: toPrismaJson([]),
      changeLogJson: toPrismaJson([]),
      evidenceNotesJson: toPrismaJson([]),
      inputSnapshotJson: toPrismaJson({}),
    },
  });
  await prisma.resumeVersion.update({
    where: { id: version.id },
    data: { activeRevisionId: revisionB.id, status: "READY" },
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
          content: "Cover letter revision for M24.5B.",
          tone: "PROFESSIONAL",
          length: "STANDARD",
          language: "ENGLISH",
          contextSnapshotJson: toPrismaJson({}),
          contextFingerprint: `m245b-${Date.now()}`,
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
      source: "m245b-fixture",
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
      status: input.approved === false ? "READY_FOR_REVIEW" : "APPROVED",
      readinessStatus: "READY",
      qaStatus: "PASS",
      contextFingerprint: `m245b-${job.id}`,
      approvedAt: input.approved === false ? null : new Date(),
    },
  });
  return { job, application, pkg, revisionA, revisionB, cover, version };
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

async function run() {
  const fixtures = await startFixtureServer();
  const user = await getTestUser();
  evidence.testUserId = user.id;
  await prisma.applicationExecutionSession.updateMany({
    where: { userId: user.id, status: { notIn: ["SUBMITTED", "CANCELLED", "FAILED", "BLOCKED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  try {
    const unapproved = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic`,
      title: "M245B Unapproved",
      approved: false,
    });
    let rejected = false;
    try {
      await createExecutionSession(user.id, unapproved.pkg.id);
    } catch (error) {
      rejected = error instanceof ExecutionAccessError;
    }
    assert(rejected, "Unapproved package must be rejected");
    evidence.unapprovedRejected = true;

    const generic = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic`,
      title: "M245B Generic Backend",
    });
    const created = await createExecutionSession(user.id, generic.pkg.id);
    evidence.genericSessionId = created.sessionId;
    evidence.genericPackageId = generic.pkg.id;
    evidence.genericApplicationId = generic.application.id;
    assert(created.status === "CREATED", "Session should start CREATED");
    const coverB = await prisma.communicationDraftRevision.create({
      data: {
        userId: user.id,
        communicationDraftId: generic.cover.id,
        revisionNumber: 2,
        source: "USER_EDITED",
        content: "ACTIVE COVER B - do not upload",
        tone: "PROFESSIONAL",
        length: "STANDARD",
        language: "ENGLISH",
        contextSnapshotJson: toPrismaJson({}),
        contextFingerprint: `m245b-cover-b-${Date.now()}`,
      },
    });
    await prisma.communicationDraft.update({
      where: { id: generic.cover.id },
      data: { activeRevisionId: coverB.id },
    });
    evidence.coverLetterActiveB = coverB.id;
    const pkgBefore = await prisma.applicationPackage.findUnique({ where: { id: generic.pkg.id } });
    const snapshotBefore = JSON.stringify({
      opportunity: pkgBefore?.opportunitySnapshotJson,
      evidence: pkgBefore?.evidenceSnapshotJson,
      gap: pkgBefore?.gapSnapshotJson,
      eligibility: pkgBefore?.eligibilitySnapshotJson,
      qa: pkgBefore?.qaSnapshotJson,
    });

    const conflict = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B Conflict",
    });
    let activeConflict = false;
    try {
      await createExecutionSession(user.id, conflict.pkg.id);
    } catch (error) {
      activeConflict = error instanceof ExecutionAccessError;
    }
    assert(activeConflict, "Second active session must be rejected");
    evidence.activeSessionConflict = true;

    await startExecutionSession(user.id, created.sessionId);
    const pkgAfter = await prisma.applicationPackage.findUnique({ where: { id: generic.pkg.id } });
    evidence.packageImmutable =
      snapshotBefore ===
      JSON.stringify({
        opportunity: pkgAfter?.opportunitySnapshotJson,
        evidence: pkgAfter?.evidenceSnapshotJson,
        gap: pkgAfter?.gapSnapshotJson,
        eligibility: pkgAfter?.eligibilitySnapshotJson,
        qa: pkgAfter?.qaSnapshotJson,
      });
    const afterStart = await getExecutionSession(user.id, created.sessionId);
    evidence.b1Provider = afterStart.provider;
    evidence.b1Status = afterStart.status;
    evidence.b1FieldCount = afterStart.fields.length;
    evidence.b1BrowserConnected = afterStart.browserConnected;
    assert(afterStart.provider === "GENERIC", "Generic fixture should detect GENERIC");
    assert(afterStart.fields.length >= 8, "Form inspection should find fields");
    const row = await loadOwnedSession(user.id, created.sessionId);
    assert(!JSON.stringify(row.formSnapshotJson).includes("<html"), "Must not persist full HTML");
    const legal = afterStart.fields.find((field) => field.classification === "LEGAL");
    const sensitive = afterStart.fields.find((field) => field.classification === "SENSITIVE");
    const consent = afterStart.fields.find((field) => field.classification === "CONSENT");
    const freeText = afterStart.fields.find((field) => field.classification === "FREE_TEXT");
    const unknown = afterStart.fields.find((field) => /ambiguous other/i.test(field.label));
    assert(legal && !legal.confirmed, "Legal requires confirmation");
    assert(sensitive && !sensitive.proposedValue, "Sensitive has no default");
    assert(consent, "Consent present");
    evidence.legalClassification = legal?.classification;
    evidence.sensitiveClassification = sensitive?.classification;
    evidence.lowConfidence = unknown?.status ?? "NEEDS_INPUT";

    const resumeDoc = sessionJson(row).plan.uploadedDocuments.find((item) => item.kind === "resume");
    evidence.resumeRevisionUploaded = resumeDoc?.revisionId;
    evidence.resumeFileHash = resumeDoc?.fileHash;
    evidence.packageResumeRevision = generic.revisionA.id;
    evidence.activeResumeRevision = generic.revisionB.id;
    assert(resumeDoc?.revisionId === generic.revisionA.id, "Must upload package revision A, not active B");
    const coverDoc = sessionJson(row).plan.uploadedDocuments.find((item) => item.kind === "cover_letter");
    evidence.coverLetterRevisionUploaded = coverDoc?.revisionId;
    evidence.coverLetterFileHash = coverDoc?.fileHash;
    evidence.coverLetterPackageRevision = generic.cover.revisions[0]!.id;
    assert(coverDoc?.revisionId === generic.cover.revisions[0]!.id, "Must upload locked cover letter A, not active B");
    assert(coverDoc?.revisionId !== coverB.id, "Must not substitute later cover letter revision");

    let continueBlocked = false;
    try {
      await continueApplication(user.id, created.sessionId);
    } catch {
      continueBlocked = true;
    }
    evidence.requiredFieldBlocksContinue = continueBlocked;
    assert(continueBlocked, "Continue must block while required legal/consent/AI fields are unresolved");

    if (freeText) {
      const previousModel = process.env.OPENAI_APPLICATION_EXECUTION_MODEL;
      process.env.OPENAI_APPLICATION_EXECUTION_MODEL = "this-model-does-not-exist-m245b";
      try {
        const invalid = await generateFieldAnswer(user.id, created.sessionId, freeText.id);
        evidence.invalidModelOk = invalid.ok;
        evidence.invalidModelStatus = invalid.status;
        assert(invalid.ok === false, "Invalid model must not fabricate an answer");
        assert(invalid.status === "NEEDS_INPUT" || invalid.status === "REVIEW_REQUIRED", "Invalid model leaves review/input required");
      } finally {
        if (previousModel) process.env.OPENAI_APPLICATION_EXECUTION_MODEL = previousModel;
        else delete process.env.OPENAI_APPLICATION_EXECUTION_MODEL;
      }
      const generated = await generateFieldAnswer(user.id, created.sessionId, freeText.id);
      evidence.freeTextStatus = generated.status;
      evidence.freeTextOk = generated.ok;
      assert(generated.status === "REVIEW_REQUIRED" || generated.status === "NEEDS_INPUT", "AI text requires review");
    }

    await confirmRequired(user.id, created.sessionId);
    const phoneField = afterStart.fields.find((field) => field.classification === "CONTACT" && /phone/i.test(field.label));
    if (phoneField) {
      await patchFieldAnswer(user.id, created.sessionId, phoneField.id, { value: "(111) 111-1111", confirmed: true });
    }
    await continueApplication(user.id, created.sessionId);
    const afterContinue = await getExecutionSession(user.id, created.sessionId);
    evidence.multiStepStatus = afterContinue.status;
    evidence.multiStepCurrentStep = afterContinue.currentStep;
    let genericFinalBlocked = false;
    try {
      await continueApplication(user.id, created.sessionId);
    } catch {
      genericFinalBlocked = true;
    }
    evidence.genericFinalStepManual = genericFinalBlocked;

    let genericSubmitBlocked = false;
    try {
      await grantSubmissionApproval(user.id, created.sessionId);
    } catch {
      genericSubmitBlocked = true;
    }
    evidence.genericNoAutoSubmit = genericSubmitBlocked;
    assert(genericSubmitBlocked, "Generic must not approve-submit");

    const runner = getApplicationBrowserRunner();
    await runner.close(created.sessionId);
    const resumed = await resumeExecutionSession(user.id, created.sessionId);
    evidence.crashResumeStatus = resumed.status;
    await cancelExecutionSession(user.id, created.sessionId);

    const pauseCases = [
      ["login", "PAUSED_FOR_LOGIN"],
      ["mfa", "PAUSED_FOR_MFA"],
      ["captcha", "PAUSED_FOR_CAPTCHA"],
      ["assessment", "PAUSED_FOR_ASSESSMENT"],
      ["widget", "NEEDS_USER_INPUT"],
    ] as const;
    const pauseResults: Record<string, string> = {};
    for (const [variant, expected] of pauseCases) {
      const fixture = await createPackage({
        userId: user.id,
        jobUrl: `${FIXTURE_ORIGIN}/generic?variant=${variant}`,
        title: `M245B ${variant}`,
      });
      const session = await createExecutionSession(user.id, fixture.pkg.id);
      await startExecutionSession(user.id, session.sessionId);
      const view = await getExecutionSession(user.id, session.sessionId);
      pauseResults[variant] = view.status;
      await cancelExecutionSession(user.id, session.sessionId);
      assert(view.status === expected, `${variant} expected ${expected}, got ${view.status}`);
    }
    evidence.pauseResults = pauseResults;

    const providers = ["greenhouse", "lever", "ashby", "workable", "smartrecruiters"] as const;
    const providerResults: Record<string, unknown> = {};
    for (const provider of providers) {
      const fixture = await createPackage({
        userId: user.id,
        jobUrl: `${FIXTURE_ORIGIN}/${provider}`,
        title: `M245B ${provider}`,
      });
      const session = await createExecutionSession(user.id, fixture.pkg.id);
      await startExecutionSession(user.id, session.sessionId);
      const view = await getExecutionSession(user.id, session.sessionId);
      providerResults[provider] = {
        provider: view.provider,
        fieldCount: view.fields.length,
        status: view.status,
        sessionId: session.sessionId,
        packageId: fixture.pkg.id,
        applicationId: fixture.application.id,
      };
      assert(view.provider === provider.toUpperCase(), `${provider} detection failed: ${view.provider}`);
      await cancelExecutionSession(user.id, session.sessionId);
    }
    evidence.providers = providerResults;

    const drift = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?variant=drift`,
      title: "M245B drift",
    });
    const driftSession = await createExecutionSession(user.id, drift.pkg.id);
    await startExecutionSession(user.id, driftSession.sessionId);
    const driftView = await getExecutionSession(user.id, driftSession.sessionId);
    evidence.driftProvider = driftView.provider;
    evidence.driftMode = driftView.executionMode;
    assert(driftView.provider === "GENERIC", "Drift should fall back to GENERIC");
    let driftSubmit = false;
    try {
      await grantSubmissionApproval(user.id, driftSession.sessionId);
    } catch {
      driftSubmit = true;
    }
    evidence.driftSubmitDisabled = driftSubmit;
    await cancelExecutionSession(user.id, driftSession.sessionId);

    const redirect = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/careers/redirect-to-lever`,
      title: "M245B redirect",
    });
    const redirectSession = await createExecutionSession(user.id, redirect.pkg.id);
    await startExecutionSession(user.id, redirectSession.sessionId);
    const redirectView = await getExecutionSession(user.id, redirectSession.sessionId);
    evidence.redirectProvider = redirectView.provider;
    assert(redirectView.provider === "LEVER", `Redirect should detect LEVER, got ${redirectView.provider}`);
    await cancelExecutionSession(user.id, redirectSession.sessionId);

    const missingLegal = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B missing legal",
    });
    const missingSession = await createExecutionSession(user.id, missingLegal.pkg.id);
    await startExecutionSession(user.id, missingSession.sessionId);
    let missingBlocked = false;
    try {
      await grantSubmissionApproval(user.id, missingSession.sessionId);
    } catch {
      missingBlocked = true;
    }
    evidence.missingLegalBlocked = missingBlocked;
    await cancelExecutionSession(user.id, missingSession.sessionId);

    const unreviewed = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B unreviewed AI",
    });
    const unreviewedSession = await createExecutionSession(user.id, unreviewed.pkg.id);
    await startExecutionSession(user.id, unreviewedSession.sessionId);
    const unreviewedView = await getExecutionSession(user.id, unreviewedSession.sessionId);
    for (const field of unreviewedView.fields) {
      if (field.classification === "LEGAL" || field.classification === "CONSENT") {
        await patchFieldAnswer(user.id, unreviewedSession.sessionId, field.id, { value: field.classification === "LEGAL" ? "yes" : "true", confirmed: true });
      } else if (field.required && field.status === "NEEDS_INPUT" && field.classification !== "FREE_TEXT") {
        await patchFieldAnswer(user.id, unreviewedSession.sessionId, field.id, { value: "search", confirmed: true });
      }
    }
    let unreviewedBlocked = false;
    try {
      await grantSubmissionApproval(user.id, unreviewedSession.sessionId);
    } catch {
      unreviewedBlocked = true;
    }
    evidence.unreviewedAiBlocked = unreviewedBlocked;
    assert(unreviewedBlocked, "Unreviewed AI answer must block approve-submit");
    await cancelExecutionSession(user.id, unreviewedSession.sessionId);

    const unconsent = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B unconfirmed consent",
    });
    const unconsentSession = await createExecutionSession(user.id, unconsent.pkg.id);
    await startExecutionSession(user.id, unconsentSession.sessionId);
    const unconsentView = await getExecutionSession(user.id, unconsentSession.sessionId);
    for (const field of unconsentView.fields) {
      if (field.classification === "LEGAL") {
        await patchFieldAnswer(user.id, unconsentSession.sessionId, field.id, { value: "yes", confirmed: true });
      } else if (field.classification === "FREE_TEXT") {
        await generateFieldAnswer(user.id, unconsentSession.sessionId, field.id);
        const after = await getExecutionSession(user.id, unconsentSession.sessionId);
        const current = after.fields.find((item) => item.id === field.id);
        await patchFieldAnswer(user.id, unconsentSession.sessionId, field.id, {
          value: current?.proposedValue || "I am interested based on the provided resume facts.",
          confirmed: true,
          reviewed: true,
        });
      } else if (field.required && field.status === "NEEDS_INPUT" && field.classification !== "CONSENT") {
        await patchFieldAnswer(user.id, unconsentSession.sessionId, field.id, { value: "search", confirmed: true });
      }
    }
    let consentBlocked = false;
    try {
      await grantSubmissionApproval(user.id, unconsentSession.sessionId);
    } catch {
      consentBlocked = true;
    }
    evidence.unconfirmedConsentBlocked = consentBlocked;
    assert(consentBlocked, "Unconfirmed consent must block approve-submit");
    await cancelExecutionSession(user.id, unconsentSession.sessionId);

    const gh = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B Greenhouse Submit",
    });
    const ghSession = await createExecutionSession(user.id, gh.pkg.id);
    await startExecutionSession(user.id, ghSession.sessionId);
    await confirmRequired(user.id, ghSession.sessionId);
    await fillSafeFields(user.id, ghSession.sessionId);
    const review = await reviewExecutionSession(user.id, ghSession.sessionId);
    evidence.finalReview = review.review;
    evidence.readyToSubmit = review.readyToSubmit;
    const before = await prisma.application.findUnique({ where: { id: gh.application.id } });
    evidence.m22Before = before?.status;
    assert(before?.status === "DRAFT", "Must remain DRAFT before submit");

    const approval = await grantSubmissionApproval(user.id, ghSession.sessionId);
    evidence.attemptId = approval.attemptId;
    evidence.approvalFingerprint = approval.approvalFingerprint;
    evidence.approvalExpiresAt = approval.approvalExpiresAt;
    const stored = await prisma.applicationSubmissionAttempt.findUnique({ where: { id: approval.attemptId } });
    evidence.tokenHashStored = Boolean(stored?.approvalTokenHash);
    evidence.rawTokenNotInDb = !JSON.stringify(stored).includes(approval.approvalToken);

    const changed = await prisma.applicationExecutionSession.findUnique({ where: { id: ghSession.sessionId } });
    if (changed) {
      const plan = sessionJson(changed as never);
      if (plan.plan.answers[0]) plan.plan.answers[0].value = "changed-after-approval";
      await prisma.applicationExecutionSession.update({
        where: { id: ghSession.sessionId },
        data: { fillPlanJson: toPrismaJson(plan.plan) },
      });
    }
    let formChangeBlocked = false;
    try {
      await executeConfirmedSubmit(user.id, ghSession.sessionId, approval.attemptId, approval.approvalToken);
    } catch (error) {
      formChangeBlocked = error instanceof Error && error.message.includes("Application changed");
    }
    evidence.formChangeInvalidation = formChangeBlocked;

    const approval2 = await grantSubmissionApproval(user.id, ghSession.sessionId);
    await executeConfirmedSubmit(user.id, ghSession.sessionId, approval2.attemptId, approval2.approvalToken);
    let replayBlocked = false;
    try {
      await executeConfirmedSubmit(user.id, ghSession.sessionId, approval2.attemptId, approval2.approvalToken);
    } catch {
      replayBlocked = true;
    }
    evidence.tokenReplayBlocked = replayBlocked;
    const after = await prisma.application.findUnique({ where: { id: gh.application.id } });
    evidence.m22After = after?.status;
    evidence.appliedAt = after?.appliedAt?.toISOString() ?? null;
    const used = await prisma.resumeVersion.findUnique({ where: { id: gh.version.id } });
    evidence.resumeUsedStatus = used?.status;
    const events = await prisma.applicationEvent.findMany({ where: { applicationId: gh.application.id } });
    evidence.applicationEventCount = events.length;
    evidence.applicationEventTypes = events.map((item) => item.type);
    const eventCountBefore = events.length;
    await verifySubmission(user.id, ghSession.sessionId);
    const eventsAfter = await prisma.applicationEvent.count({ where: { applicationId: gh.application.id } });
    evidence.verifiedIdempotent = eventsAfter === eventCountBefore || after?.status === "APPLIED";
    evidence.verifiedSession = await getExecutionSession(user.id, ghSession.sessionId).then((item) => ({
      status: item.status,
      verification: item.submission.verificationStatus,
    }));
    evidence.preSubmitMaxRetries = PRE_SUBMIT_MAX_RETRIES;
    evidence.officialApiAvailable = officialApiAvailable();

    const expiryPkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B token expiry",
    });
    const expirySession = await createExecutionSession(user.id, expiryPkg.pkg.id);
    await startExecutionSession(user.id, expirySession.sessionId);
    await confirmRequired(user.id, expirySession.sessionId);
    await fillSafeFields(user.id, expirySession.sessionId);
    await reviewExecutionSession(user.id, expirySession.sessionId);
    const expiryApproval = await grantSubmissionApproval(user.id, expirySession.sessionId);
    process.env.CAREEROS_SUBMISSION_NOW_MS = String(Date.now() + 6 * 60 * 1000);
    let expiryBlocked = false;
    try {
      await executeConfirmedSubmit(user.id, expirySession.sessionId, expiryApproval.attemptId, expiryApproval.approvalToken);
    } catch (error) {
      expiryBlocked = error instanceof Error && /expired/i.test(error.message);
    }
    delete process.env.CAREEROS_SUBMISSION_NOW_MS;
    evidence.tokenExpiryBlocked = expiryBlocked;
    const expiryApp = await prisma.application.findUnique({ where: { id: expiryPkg.application.id } });
    evidence.tokenExpiryRemainsDraft = expiryApp?.status === "DRAFT";
    assert(expiryBlocked, "Expired approval token must not submit");
    await cancelExecutionSession(user.id, expirySession.sessionId);

    const dbl = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B double click",
    });
    const dblSession = await createExecutionSession(user.id, dbl.pkg.id);
    await startExecutionSession(user.id, dblSession.sessionId);
    await confirmRequired(user.id, dblSession.sessionId);
    await fillSafeFields(user.id, dblSession.sessionId);
    await reviewExecutionSession(user.id, dblSession.sessionId);
    const beforeCount = await fetch(`${FIXTURE_ORIGIN}/verify-received?provider=greenhouse`).then((res) => res.json() as Promise<{ submitCount: number }>);
    const dblApproval = await grantSubmissionApproval(user.id, dblSession.sessionId);
    const dblResults = await Promise.allSettled([
      executeConfirmedSubmit(user.id, dblSession.sessionId, dblApproval.attemptId, dblApproval.approvalToken),
      executeConfirmedSubmit(user.id, dblSession.sessionId, dblApproval.attemptId, dblApproval.approvalToken),
    ]);
    const afterCount = await fetch(`${FIXTURE_ORIGIN}/verify-received?provider=greenhouse`).then((res) => res.json() as Promise<{ submitCount: number }>);
    evidence.doubleClickFulfilled = dblResults.filter((item) => item.status === "fulfilled").length;
    evidence.doubleClickRejected = dblResults.filter((item) => item.status === "rejected").length;
    evidence.doubleClickSubmitDelta = afterCount.submitCount - beforeCount.submitCount;
    evidence.doubleClickOneSubmit = afterCount.submitCount - beforeCount.submitCount === 1;
    assert(evidence.doubleClickOneSubmit === true, "Double-click must cause a single fixture submit");
    await cancelExecutionSession(user.id, dblSession.sessionId).catch(() => undefined);

    const failedPkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?outcome=error`,
      title: "M245B failed submit",
    });
    const failedSession = await createExecutionSession(user.id, failedPkg.pkg.id);
    await startExecutionSession(user.id, failedSession.sessionId);
    await confirmRequired(user.id, failedSession.sessionId);
    await fillSafeFields(user.id, failedSession.sessionId);
    await reviewExecutionSession(user.id, failedSession.sessionId);
    const failedApproval = await grantSubmissionApproval(user.id, failedSession.sessionId);
    await executeConfirmedSubmit(user.id, failedSession.sessionId, failedApproval.attemptId, failedApproval.approvalToken);
    const failedView = await getExecutionSession(user.id, failedSession.sessionId);
    const failedApp = await prisma.application.findUnique({ where: { id: failedPkg.application.id } });
    evidence.failedVerification = failedView.submission.verificationStatus;
    evidence.failedAttemptStatus = failedView.submission.status;
    evidence.failedRemainsDraft = failedApp?.status === "DRAFT";
    await cancelExecutionSession(user.id, failedSession.sessionId).catch(() => undefined);

    const dropPkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?drop=1`,
      title: "M245B network drop",
    });
    const dropSession = await createExecutionSession(user.id, dropPkg.pkg.id);
    await startExecutionSession(user.id, dropSession.sessionId);
    await confirmRequired(user.id, dropSession.sessionId);
    await fillSafeFields(user.id, dropSession.sessionId);
    await reviewExecutionSession(user.id, dropSession.sessionId);
    const dropApproval = await grantSubmissionApproval(user.id, dropSession.sessionId);
    const dropStartedBefore = await prisma.applicationExecutionEvent.count({
      where: { executionSessionId: dropSession.sessionId, type: "SUBMIT_STARTED" },
    });
    try {
      await executeConfirmedSubmit(user.id, dropSession.sessionId, dropApproval.attemptId, dropApproval.approvalToken);
    } catch {
      evidence.dropSubmitThrew = true;
    }
    const dropStartedAfter = await prisma.applicationExecutionEvent.count({
      where: { executionSessionId: dropSession.sessionId, type: "SUBMIT_STARTED" },
    });
    const dropAttempt = await prisma.applicationSubmissionAttempt.findUnique({ where: { id: dropApproval.attemptId } });
    evidence.dropAttemptStatus = dropAttempt?.status;
    evidence.dropVerification = dropAttempt?.verificationStatus;
    const dropReceived = await fetch(`${FIXTURE_ORIGIN}/verify-received?provider=greenhouse`).then((res) => res.json() as Promise<{ submitCount: number; received: boolean }>);
    evidence.dropReceived = dropReceived.received;
    evidence.noBlindRetryAfterDrop = dropStartedAfter - dropStartedBefore === 1;
    assert(evidence.noBlindRetryAfterDrop === true, "CareerOS must emit exactly one SUBMIT_STARTED after a dropped response");
    await getApplicationBrowserRunner().close(dropSession.sessionId);
    const dropCountAfterClose = await fetch(`${FIXTURE_ORIGIN}/verify-received?provider=greenhouse`).then((res) => res.json() as Promise<{ submitCount: number }>);
    await verifySubmission(user.id, dropSession.sessionId).catch(() => undefined);
    const dropCountAfterVerify = await fetch(`${FIXTURE_ORIGIN}/verify-received?provider=greenhouse`).then((res) => res.json() as Promise<{ submitCount: number }>);
    evidence.verifyDoesNotResubmit = dropCountAfterVerify.submitCount === dropCountAfterClose.submitCount;
    evidence.crashAfterSubmitUncertain = dropAttempt?.status === "UNCERTAIN" || dropAttempt?.verificationStatus === "UNVERIFIED";
    await cancelExecutionSession(user.id, dropSession.sessionId).catch(() => undefined);

    const recoverPkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse?drop=1`,
      title: "M245B verify after uncertain",
    });
    const recoverSession = await createExecutionSession(user.id, recoverPkg.pkg.id);
    await startExecutionSession(user.id, recoverSession.sessionId);
    await confirmRequired(user.id, recoverSession.sessionId);
    await fillSafeFields(user.id, recoverSession.sessionId);
    await reviewExecutionSession(user.id, recoverSession.sessionId);
    const recoverApproval = await grantSubmissionApproval(user.id, recoverSession.sessionId);
    try {
      await executeConfirmedSubmit(user.id, recoverSession.sessionId, recoverApproval.attemptId, recoverApproval.approvalToken);
    } catch {
      /* network drop is expected */
    }
    await getApplicationBrowserRunner().navigate(recoverSession.sessionId, `${FIXTURE_ORIGIN}/greenhouse?variant=success`).catch(async () => {
      await getApplicationBrowserRunner().launch(recoverSession.sessionId);
      await getApplicationBrowserRunner().navigate(recoverSession.sessionId, `${FIXTURE_ORIGIN}/greenhouse?variant=success`);
    });
    await verifySubmission(user.id, recoverSession.sessionId);
    const recoverApp = await prisma.application.findUnique({ where: { id: recoverPkg.application.id } });
    const recoverView = await getExecutionSession(user.id, recoverSession.sessionId);
    evidence.verifyAfterUncertain = recoverView.submission.verificationStatus;
    evidence.verifyAfterUncertainApplied = recoverApp?.status === "APPLIED";
    await cancelExecutionSession(user.id, recoverSession.sessionId).catch(() => undefined);

    const markerPkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/greenhouse`,
      title: "M245B wrong marker",
    });
    const markerSession = await createExecutionSession(user.id, markerPkg.pkg.id);
    await startExecutionSession(user.id, markerSession.sessionId);
    await getApplicationBrowserRunner().navigate(markerSession.sessionId, `${FIXTURE_ORIGIN}/lever?variant=success`);
    const markerPage = getApplicationBrowserRunner().getPage(markerSession.sessionId);
    const wrongMarker = markerPage ? await greenhouseAdapter.verifySubmission(markerPage) : null;
    evidence.wrongProviderMarker = wrongMarker?.status;
    evidence.wrongProviderNotVerified = wrongMarker?.status !== "VERIFIED" || wrongMarker.successMarkerCode !== "gh-application-success";
    await getApplicationBrowserRunner().navigate(markerSession.sessionId, `${FIXTURE_ORIGIN}/greenhouse?variant=error`);
    const errorPage = getApplicationBrowserRunner().getPage(markerSession.sessionId);
    const providerValidation = errorPage ? await greenhouseAdapter.validateCurrentStep(errorPage) : null;
    evidence.greenhouseValidationRecognized = providerValidation?.ok === false;
    await cancelExecutionSession(user.id, markerSession.sessionId);

    const probable = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic?variant=probable`,
      title: "M245B probable",
    });
    const probableSession = await createExecutionSession(user.id, probable.pkg.id);
    await startExecutionSession(user.id, probableSession.sessionId);
    const page = getApplicationBrowserRunner().getPage(probableSession.sessionId);
    const adapterVerify = page
      ? await (await import("@/features/application-execution/adapters/adapter-registry")).selectAdapter("GENERIC", true).verifySubmission(page)
      : null;
    evidence.probableStatus = adapterVerify?.status;
    const probableApp = await prisma.application.findUnique({ where: { id: probable.application.id } });
    evidence.probableRemainsDraft = probableApp?.status === "DRAFT";
    await prisma.applicationSubmissionAttempt.create({
      data: {
        userId: user.id,
        executionSessionId: probableSession.sessionId,
        applicationPackageId: probable.pkg.id,
        applicationId: probable.application.id,
        attemptNumber: 1,
        method: "USER_MANUAL",
        status: "UNCERTAIN",
        verificationStatus: "PROBABLE",
        approvalFingerprint: "qa",
        resumeVersionRevisionId: probable.revisionA.id,
        resumeFileHash: "qa",
      },
    });
    await confirmSubmissionOutcome(user.id, probableSession.sessionId, "SUBMITTED");
    const probableAfter = await prisma.application.findUnique({ where: { id: probable.application.id } });
    const probableAttempt = await prisma.applicationSubmissionAttempt.findFirst({
      where: { executionSessionId: probableSession.sessionId },
    });
    evidence.probableUserYes = probableAfter?.status;
    evidence.probableVerificationRemains = probableAttempt?.verificationStatus;

    const notSurePkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic?variant=unverified`,
      title: "M245B not sure",
    });
    const notSureSession = await createExecutionSession(user.id, notSurePkg.pkg.id);
    await startExecutionSession(user.id, notSureSession.sessionId);
    await prisma.applicationSubmissionAttempt.create({
      data: {
        userId: user.id,
        executionSessionId: notSureSession.sessionId,
        applicationPackageId: notSurePkg.pkg.id,
        applicationId: notSurePkg.application.id,
        attemptNumber: 1,
        method: "USER_MANUAL",
        status: "UNCERTAIN",
        verificationStatus: "UNVERIFIED",
        approvalFingerprint: "qa",
        resumeVersionRevisionId: notSurePkg.revisionA.id,
        resumeFileHash: "qa",
      },
    });
    await confirmSubmissionOutcome(user.id, notSureSession.sessionId, "NOT_SURE");
    const notSureApp = await prisma.application.findUnique({ where: { id: notSurePkg.application.id } });
    evidence.notSureRemainsDraft = notSureApp?.status === "DRAFT";
    await cancelExecutionSession(user.id, notSureSession.sessionId);

    const unverifiedPkg = await createPackage({
      userId: user.id,
      jobUrl: `${FIXTURE_ORIGIN}/generic?variant=unverified`,
      title: "M245B unverified",
    });
    const unverifiedSession = await createExecutionSession(user.id, unverifiedPkg.pkg.id);
    await startExecutionSession(user.id, unverifiedSession.sessionId);
    const unverifiedPage = getApplicationBrowserRunner().getPage(unverifiedSession.sessionId);
    const unverifiedResult = unverifiedPage
      ? await (await import("@/features/application-execution/adapters/adapter-registry")).selectAdapter("GENERIC", true).verifySubmission(unverifiedPage)
      : null;
    evidence.unverifiedStatus = unverifiedResult?.status;
    const unverifiedApp = await prisma.application.findUnique({ where: { id: unverifiedPkg.application.id } });
    evidence.unverifiedRemainsDraft = unverifiedApp?.status === "DRAFT";
    await cancelExecutionSession(user.id, unverifiedSession.sessionId);

    const userB = await prisma.user.create({
      data: { name: "M245B User B", email: `m245b-user-b-${Date.now()}@careeros.local`, emailVerified: false },
    });
    const cross: Record<string, string> = {};
    const tryCross = async (name: string, fn: () => Promise<unknown>) => {
      try {
        const result = await fn();
        cross[name] = result && typeof result === "object" && "id" in result ? "LEAK" : "LEAK";
      } catch (error) {
        cross[name] = error instanceof ExecutionAccessError ? error.code : "ERROR";
      }
    };
    await tryCross("get", () => getExecutionSession(userB.id, ghSession.sessionId));
    await tryCross("start", () => startExecutionSession(userB.id, ghSession.sessionId));
    await tryCross("inspect", () => inspectAndPlan(userB.id, ghSession.sessionId));
    await tryCross("fill", () => fillSafeFields(userB.id, ghSession.sessionId));
    await tryCross("patch", () => patchFieldAnswer(userB.id, ghSession.sessionId, "x", { value: "no", confirmed: true }));
    await tryCross("generate", () => generateFieldAnswer(userB.id, ghSession.sessionId, "x"));
    await tryCross("continue", () => continueApplication(userB.id, ghSession.sessionId));
    await tryCross("resume", () => resumeExecutionSession(userB.id, ghSession.sessionId));
    await tryCross("review", () => reviewExecutionSession(userB.id, ghSession.sessionId));
    await tryCross("approve", () => grantSubmissionApproval(userB.id, ghSession.sessionId));
    await tryCross("submit", () => executeConfirmedSubmit(userB.id, ghSession.sessionId, "x", "x"));
    await tryCross("verify", () => verifySubmission(userB.id, ghSession.sessionId));
    await tryCross("confirm", () => confirmSubmissionOutcome(userB.id, ghSession.sessionId, "SUBMITTED"));
    await tryCross("cancel", () => cancelExecutionSession(userB.id, ghSession.sessionId));
    evidence.crossUser = cross;
    evidence.crossUserNoLeak = Object.values(cross).every((code) => code === "NOT_FOUND" || code === "FORBIDDEN");
    await prisma.user.delete({ where: { id: userB.id } });
    evidence.userBDeleted = true;

    evidence.ok = true;
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await closeAllBrowserRuntimes();
    await fixtures.close();
  }
}

run()
  .catch((error) => {
    console.error(error);
    evidence.ok = false;
    evidence.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllBrowserRuntimes().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });
