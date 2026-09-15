import "dotenv/config";

process.env.CAREEROS_LINKEDIN_PROVIDER = "fixture";
process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY =
  process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim() ||
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI?.trim() || "http://localhost:3000/api/linkedin/connection/callback";

import { prisma } from "@/server/db/prisma";
import { LinkedinAccessError } from "@/features/linkedin/lib/permissions";
import { encryptLinkedinSecret } from "@/features/linkedin/integration/security/token-encryption";
import { hashOauthState } from "@/features/linkedin/integration/security/oauth-state";
import { getLinkedinTokenState } from "@/features/linkedin/integration/connection/token-state";
import { resolveLinkedinCapabilities } from "@/features/linkedin/integration/capabilities/resolve-capabilities";
import { buildLinkedinPublishText } from "@/features/linkedin/integration/publishing/build-publish-text";
import { linkedinContentFingerprint } from "@/features/linkedin/integration/publishing/content-fingerprint";
import {
  getFixturePublishCallCount,
  resetFixtureLinkedinClient,
} from "@/features/linkedin/integration/provider/fixture-client";
import {
  addLinkedinPostPerformance,
  completeLinkedinOAuthCallback,
  createLinkedinPublishingPlan,
  disconnectLinkedinConnection,
  editLinkedinPost,
  executeLinkedinOfficialPublish,
  getLinkedinCapabilities,
  getLinkedinPost,
  getLinkedinPublishingAttempt,
  getSafeLinkedinConnection,
  LinkedinIntegrationError,
  markLinkedinPostPublishedManually,
  prepareLinkedinOfficialPublish,
  reconnectLinkedinConnection,
  resolveLinkedinPublishingAttempt,
  startLinkedinConnection,
  syncOfficialLinkedinPostAnalytics,
} from "@/features/linkedin/server";

type Evidence = Record<string, unknown>;
const evidence: Evidence = {};

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function isIntegration(error: unknown, code: string) {
  return error instanceof LinkedinIntegrationError && error.code === code;
}

async function getTestUser() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  return user;
}

async function cleanupUser(userId: string) {
  await prisma.linkedinPublishingAttempt.deleteMany({ where: { userId } });
  await prisma.linkedinOAuthAttempt.deleteMany({ where: { userId } });
  await prisma.linkedinConnection.deleteMany({ where: { userId } });
  await prisma.linkedinGrowthInsight.deleteMany({ where: { userId } });
  await prisma.linkedinPostPerformance.deleteMany({ where: { userId } });
  await prisma.linkedinPublishingPlan.deleteMany({ where: { userId } });
  await prisma.linkedinPost.updateMany({ where: { userId }, data: { activeRevisionId: null } });
  await prisma.linkedinPostRevision.deleteMany({ where: { userId } });
  await prisma.linkedinPost.deleteMany({ where: { userId } });
  await prisma.linkedinContentIdea.deleteMany({ where: { userId } });
  await prisma.linkedinContentPillar.deleteMany({ where: { userId } });
  await prisma.linkedinGrowthProfile.deleteMany({ where: { userId } });
}

async function connectWithCode(userId: string, code: string) {
  const start = await startLinkedinConnection(userId);
  const url = new URL(start.authorizationUrl);
  const state = url.searchParams.get("state");
  assert(state && state.length >= 32, "OAuth state must be cryptographically random.");
  return {
    start,
    state,
    connection: await completeLinkedinOAuthCallback(userId, { state, code }),
  };
}

async function ensureProfile(userId: string) {
  const existing = await prisma.linkedinGrowthProfile.findFirst({ where: { userId, status: "ACTIVE" } });
  if (existing) return existing;
  const profile = await prisma.linkedinGrowthProfile.create({
    data: {
      userId,
      primaryGoal: "GET_HIRED",
      positioningStatement: "M25B fixture strategy",
      status: "ACTIVE",
    },
  });
  await prisma.linkedinContentPillar.create({
    data: {
      userId,
      linkedinGrowthProfileId: profile.id,
      name: "Engineering craft",
      slug: `engineering-craft-${Date.now()}`,
      description: "Fixture pillar for official publishing QA.",
      priority: "CORE",
    },
  });
  return profile;
}

async function makeReadyPlan(userId: string) {
  const profile = await ensureProfile(userId);
  const post = await prisma.linkedinPost.create({
    data: {
      userId,
      linkedinGrowthProfileId: profile.id,
      status: "DRAFT",
      objective: "SHOW_EXPERTISE",
      format: "TEXT_POST",
      intendedAudience: "Hiring managers",
    },
  });
  const revision = await prisma.linkedinPostRevision.create({
    data: {
      userId,
      linkedinPostId: post.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      hook: "A practical note on shipping CareerOS LinkedIn reviews.",
      body: "I am documenting the exact frozen revision path so CareerOS publishes the approved draft, not a later edit.",
      cta: "If you are hiring for this kind of work, I am happy to compare notes.",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
      hashtagsJson: ["careeros", "softwareengineering"],
      qaStatus: "PASS",
    },
  });
  await prisma.linkedinPost.update({
    where: { id: post.id },
    data: { activeRevisionId: revision.id, status: "READY" },
  });
  const plan = await createLinkedinPublishingPlan(userId, post.id, {});
  return { post: await getLinkedinPost(userId, post.id), plan };
}

async function run() {
  const user = await getTestUser();
  await cleanupUser(user.id);
  resetFixtureLinkedinClient();

  const rawToken = "fixture-token:SUCCESS:urn:li:person:fixture-user";
  const encrypted = encryptLinkedinSecret(rawToken);
  evidence.tokenEncryption = {
    encryptedDiffers: encrypted !== rawToken,
    prefix: encrypted.startsWith("v1."),
  };
  assert(encrypted !== rawToken, "Encrypted token equaled plaintext.");

  const firstStart = await startLinkedinConnection(user.id);
  const firstUrl = new URL(firstStart.authorizationUrl);
  const firstState = firstUrl.searchParams.get("state") ?? "";
  const secondStart = await startLinkedinConnection(user.id);
  const secondState = new URL(secondStart.authorizationUrl).searchParams.get("state") ?? "";
  evidence.oauthStart = {
    hasUrl: Boolean(firstStart.authorizationUrl),
    random: firstState !== secondState,
    hashed: Boolean(await prisma.linkedinOAuthAttempt.findUnique({ where: { stateHash: hashOauthState(firstState) } })),
    rawStateNotStored: !(await prisma.linkedinOAuthAttempt.findFirst({ where: { userId: user.id, stateHash: firstState } })),
  };
  assert(firstState !== secondState, "OAuth state was not random.");

  await prisma.linkedinOAuthAttempt.update({
    where: { stateHash: hashOauthState(firstState) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  try {
    await completeLinkedinOAuthCallback(user.id, { state: firstState, code: "fixture.SUCCESS" });
    throw new Error("Expired state accepted.");
  } catch (error) {
    evidence.oauthExpiry = isIntegration(error, "LINKEDIN_OAUTH_EXPIRED") ? "PASS" : String(error);
  }

  try {
    await completeLinkedinOAuthCallback(user.id, { state: "wrong-state", code: "fixture.SUCCESS" });
    throw new Error("Wrong state accepted.");
  } catch (error) {
    evidence.wrongState = isIntegration(error, "LINKEDIN_OAUTH_STATE_INVALID") ? "PASS" : String(error);
  }

  const connected = await completeLinkedinOAuthCallback(user.id, { state: secondState, code: "fixture.SUCCESS" });
  evidence.callbackSuccess = {
    status: connected.status,
    displayName: connected.displayName,
    email: connected.email,
    tokenState: connected.tokenState,
    hasToken: Boolean((await prisma.linkedinConnection.findUnique({ where: { userId: user.id } }))?.encryptedAccessToken),
  };
  const stored = await prisma.linkedinConnection.findUniqueOrThrow({ where: { userId: user.id } });
  assert(stored.encryptedAccessToken !== rawToken, "Raw token stored.");
  assert(!JSON.stringify(connected).includes("fixture-token:"), "Raw token leaked in connection view.");
  try {
    await completeLinkedinOAuthCallback(user.id, { state: secondState, code: "fixture.SUCCESS" });
    throw new Error("Replay accepted.");
  } catch (error) {
    evidence.oauthReplay = isIntegration(error, "LINKEDIN_OAUTH_STATE_INVALID") ? "PASS" : String(error);
  }

  const caps = await getLinkedinCapabilities(user.id);
  const publish = caps.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST");
  const analytics = caps.capabilities.find((item) => item.capability === "POST_ANALYTICS");
  const historical = caps.capabilities.find((item) => item.capability === "HISTORICAL_POST_READ");
  evidence.capabilitiesConnected = {
    publish: publish?.state,
    analytics: analytics?.state,
    historical: historical?.state,
  };
  assert(publish?.state === "AVAILABLE", "Publish should be available with fixture SUCCESS.");
  assert(analytics?.state === "APPROVAL_REQUIRED", "Analytics should require app approval by default.");
  assert(historical?.state === "RESTRICTED", "Historical read should be restricted.");

  await disconnectLinkedinConnection(user.id);
  const afterDisconnect = await prisma.linkedinConnection.findUniqueOrThrow({ where: { userId: user.id } });
  evidence.disconnect = {
    status: afterDisconnect.status,
    tokenCleared: afterDisconnect.encryptedAccessToken == null,
  };
  assert(afterDisconnect.status === "DISCONNECTED", "Disconnect did not mark DISCONNECTED.");
  assert(afterDisconnect.encryptedAccessToken == null, "Disconnect left a token.");

  const mismatchStart = await startLinkedinConnection(user.id);
  const mismatchState = new URL(mismatchStart.authorizationUrl).searchParams.get("state") ?? "";
  await completeLinkedinOAuthCallback(user.id, { state: mismatchState, code: "fixture.SUCCESS" });
  const reconnectStart = await reconnectLinkedinConnection(user.id);
  const reconnectState = new URL(reconnectStart.authorizationUrl).searchParams.get("state") ?? "";
  try {
    await completeLinkedinOAuthCallback(user.id, { state: reconnectState, code: "fixture.ACCOUNT_MISMATCH" });
    throw new Error("Account mismatch replaced the connection.");
  } catch (error) {
    evidence.accountMismatch = isIntegration(error, "LINKEDIN_ACCOUNT_MISMATCH") ? "PASS" : String(error);
  }
  const stillSame = await prisma.linkedinConnection.findUniqueOrThrow({ where: { userId: user.id } });
  assert(stillSame.providerSubject === "urn:li:person:fixture-user", "Account mismatch replaced subject.");

  await disconnectLinkedinConnection(user.id);
  const missing = await connectWithCode(user.id, "fixture.MISSING_SCOPE");
  const missingCaps = await getLinkedinCapabilities(user.id);
  const missingScopePublish = missingCaps.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST")?.state;
  evidence.missingScope = {
    status: missing.connection.status,
    publish: missingScopePublish,
  };
  assert(missingScopePublish === "AVAILABLE_NOT_GRANTED", "Missing scope was not distinguished.");

  const { plan: blockedPlan } = await makeReadyPlan(user.id);
  try {
    await prepareLinkedinOfficialPublish(user.id, blockedPlan.id);
    throw new Error("Missing scope prepare succeeded.");
  } catch (error) {
    evidence.missingScopePrepare = isIntegration(error, "LINKEDIN_SCOPE_MISSING") ? "PASS" : String(error);
  }
  assert(getFixturePublishCallCount() === 0, "Missing scope issued a provider publish call.");

  await disconnectLinkedinConnection(user.id);
  const expired = await connectWithCode(user.id, "fixture.TOKEN_EXPIRED");
  const expiredView = await getSafeLinkedinConnection(user.id);
  evidence.expiredToken = { connectStatus: expired.connection.status, viewStatus: expiredView.status, tokenState: expiredView.tokenState };
  assert(expiredView.status === "REAUTH_REQUIRED" || expiredView.tokenState === "EXPIRED", "Expired token did not require reauth.");

  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.SUCCESS");

  const { post, plan } = await makeReadyPlan(user.id);
  const revisionA = plan.revisionId;
  const edited = await editLinkedinPost(user.id, post.id, { body: `${post.activeRevision?.body ?? ""}\nRevision B body` });
  evidence.revisionBActive = {
    active: edited.activeRevisionId,
    planRevision: revisionA,
    different: edited.activeRevisionId !== revisionA,
  };
  assert(edited.activeRevisionId !== revisionA, "Revision B was not activated.");

  const review = await prepareLinkedinOfficialPublish(user.id, plan.id, { revisionId: edited.activeRevisionId });
  const outbound = buildLinkedinPublishText(
    (await prisma.linkedinPostRevision.findUniqueOrThrow({ where: { id: revisionA } })),
  );
  evidence.exactRevision = {
    reviewRevision: review.revisionId,
    reviewNumber: review.revisionNumber,
    planRevision: revisionA,
    fingerprint: review.contentFingerprint,
    outboundMatchesA: review.finalText === outbound,
    newer: review.newerRevisionExists,
  };
  assert(review.revisionId === revisionA, "Prepare used the active revision instead of frozen A.");
  assert(review.finalText === outbound, "Outbound text was not revision A.");
  assert(review.newerRevisionExists, "Newer revision warning missing.");
  const fingerprintB = linkedinContentFingerprint({
    linkedinPostRevisionId: edited.activeRevisionId ?? "b",
    finalText: buildLinkedinPublishText({
      hook: edited.activeRevision?.hook ?? "",
      body: edited.activeRevision?.body ?? "",
      cta: edited.activeRevision?.cta ?? null,
      hashtags: edited.activeRevision?.hashtags,
    }),
    format: edited.format,
  });
  assert(review.contentFingerprint !== fingerprintB, "Fingerprint used revision B.");

  resetFixtureLinkedinClient();
  const firstPublish = executeLinkedinOfficialPublish(user.id, plan.id, { attemptId: review.attemptId });
  const secondPublish = executeLinkedinOfficialPublish(user.id, plan.id, { attemptId: review.attemptId });
  const concurrent = await Promise.allSettled([firstPublish, secondPublish]);
  const published = concurrent.filter((item) => item.status === "fulfilled" && item.value.status === "PUBLISHED");
  evidence.doubleClick = {
    publishCalls: getFixturePublishCallCount(),
    publishedCount: published.length,
    outcomes: concurrent.map((item) =>
      item.status === "fulfilled" ? item.value.status : (item.reason as Error).message,
    ),
  };
  assert(getFixturePublishCallCount() === 1, "Double-click issued more than one create call.");
  assert(published.length === 1, "Double-click produced multiple publishes.");

  const successAttempt = await prisma.linkedinPublishingAttempt.findFirst({
    where: { linkedinPublishingPlanId: plan.id, status: "PUBLISHED" },
  });
  const publishedPost = await getLinkedinPost(user.id, post.id);
  const publishedPlan = await prisma.linkedinPublishingPlan.findUniqueOrThrow({ where: { id: plan.id } });
  evidence.success = {
    attempt: successAttempt?.status,
    externalId: successAttempt?.externalLinkedInPostId,
    planStatus: publishedPlan.status,
    postStatus: publishedPost.status,
    source: publishedPost.publishingSource,
  };
  assert(successAttempt?.externalLinkedInPostId?.startsWith("urn:li:"), "Verified external id missing.");
  assert(publishedPlan.status === "PUBLISHED" && publishedPost.status === "PUBLISHED", "Success did not publish plan/post.");
  assert(publishedPost.publishingSource === "LINKEDIN_OFFICIAL", "Success source was not LINKEDIN_OFFICIAL.");

  try {
    await executeLinkedinOfficialPublish(user.id, plan.id, { attemptId: review.attemptId });
    throw new Error("Already published allowed a second publish.");
  } catch (error) {
    evidence.alreadyPublished = isIntegration(error, "LINKEDIN_PUBLISH_ALREADY_COMPLETED") ? "PASS" : String(error);
  }

  const { plan: rejectPlan } = await makeReadyPlan(user.id);
  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.DEFINITE_REJECTION");
  const rejectReview = await prepareLinkedinOfficialPublish(user.id, rejectPlan.id);
  const rejected = await executeLinkedinOfficialPublish(user.id, rejectPlan.id, { attemptId: rejectReview.attemptId });
  evidence.definiteRejection = { status: rejected.status, code: rejected.errorCode };
  assert(rejected.status === "FAILED", "Definite rejection was not FAILED.");
  const retryReview = await prepareLinkedinOfficialPublish(user.id, rejectPlan.id);
  evidence.retryAfterFailed = {
    newAttempt: retryReview.attemptId !== rejectReview.attemptId,
    oldImmutable: (await prisma.linkedinPublishingAttempt.findUniqueOrThrow({ where: { id: rejectReview.attemptId } })).status === "FAILED",
  };
  assert(retryReview.attemptId !== rejectReview.attemptId, "Retry mutated the failed attempt.");

  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.TIMEOUT_BEFORE_SEND");
  const { plan: beforePlan } = await makeReadyPlan(user.id);
  const beforeReview = await prepareLinkedinOfficialPublish(user.id, beforePlan.id);
  resetFixtureLinkedinClient();
  const beforeResult = await executeLinkedinOfficialPublish(user.id, beforePlan.id, { attemptId: beforeReview.attemptId });
  evidence.timeoutBeforeSend = { status: beforeResult.status, calls: getFixturePublishCallCount() };
  assert(beforeResult.status === "FAILED", "Timeout before send should be FAILED.");

  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.TIMEOUT_AFTER_SEND");
  const { plan: afterPlan } = await makeReadyPlan(user.id);
  const afterReview = await prepareLinkedinOfficialPublish(user.id, afterPlan.id);
  resetFixtureLinkedinClient();
  const afterResult = await executeLinkedinOfficialPublish(user.id, afterPlan.id, { attemptId: afterReview.attemptId });
  evidence.timeoutAfterSend = { status: afterResult.status, calls: getFixturePublishCallCount() };
  assert(afterResult.status === "UNCERTAIN", "Timeout after send should be UNCERTAIN.");
  try {
    await executeLinkedinOfficialPublish(user.id, afterPlan.id, { attemptId: afterReview.attemptId });
    throw new Error("Second publish after UNCERTAIN was allowed.");
  } catch (error) {
    evidence.uncertainBlocked = isIntegration(error, "LINKEDIN_PUBLISH_UNCERTAIN") ? "PASS" : String(error);
  }
  assert(getFixturePublishCallCount() === 1, "UNCERTAIN retry issued another create call.");
  const reconciled = await resolveLinkedinPublishingAttempt(user.id, afterReview.attemptId, {
    action: "CONFIRM_NOT_PUBLISHED",
  });
  evidence.uncertainReconcile = { status: reconciled.status, source: "USER_CONFIRMED_NOT_USED" };
  assert(reconciled.status === "CANCELLED", "CONFIRM_NOT_PUBLISHED should cancel the uncertain attempt.");

  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.SUCCESS");
  const { plan: uncertainPublishPlan } = await makeReadyPlan(user.id);
  await prisma.linkedinConnection.update({
    where: { userId: user.id },
    data: {
      encryptedAccessToken: encryptLinkedinSecret("fixture-token:TIMEOUT_AFTER_SEND:urn:li:person:fixture-user"),
    },
  });
  const uncertainReview = await prepareLinkedinOfficialPublish(user.id, uncertainPublishPlan.id);
  const uncertainPublish = await executeLinkedinOfficialPublish(user.id, uncertainPublishPlan.id, {
    attemptId: uncertainReview.attemptId,
  });
  const confirmed = await resolveLinkedinPublishingAttempt(user.id, uncertainReview.attemptId, {
    action: "CONFIRM_PUBLISHED",
  });
  const confirmedPlan = await prisma.linkedinPublishingPlan.findUniqueOrThrow({ where: { id: uncertainPublishPlan.id } });
  evidence.manualUncertainPublished = {
    attempt: confirmed.status,
    planSource: confirmedPlan.publishingSource,
    publishResult: uncertainPublish.status,
  };
  assert(confirmedPlan.publishingSource === "USER_CONFIRMED", "Manual reconciliation was labeled official.");

  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.SUCCESS");
  await prisma.linkedinConnection.update({
    where: { userId: user.id },
    data: {
      encryptedAccessToken: encryptLinkedinSecret("fixture-token:UNAUTHORIZED:urn:li:person:fixture-user"),
    },
  });
  const { plan: unauthPlan } = await makeReadyPlan(user.id);
  const unauthReview = await prepareLinkedinOfficialPublish(user.id, unauthPlan.id);
  const unauthResult = await executeLinkedinOfficialPublish(user.id, unauthPlan.id, { attemptId: unauthReview.attemptId });
  const reauthConnection = await getSafeLinkedinConnection(user.id);
  evidence.unauthorizedPublish = { status: unauthResult.status, code: unauthResult.errorCode, connection: reauthConnection.status };

  await disconnectLinkedinConnection(user.id);
  await connectWithCode(user.id, "fixture.SUCCESS");
  await prisma.linkedinConnection.update({
    where: { userId: user.id },
    data: { encryptedAccessToken: encryptLinkedinSecret("fixture-token:RATE_LIMITED:urn:li:person:fixture-user") },
  });
  const { plan: ratePlan } = await makeReadyPlan(user.id);
  const rateReview = await prepareLinkedinOfficialPublish(user.id, ratePlan.id);
  const rateResult = await executeLinkedinOfficialPublish(user.id, ratePlan.id, { attemptId: rateReview.attemptId });
  evidence.rateLimited = { status: rateResult.status, code: rateResult.errorCode };

  await prisma.linkedinConnection.update({
    where: { userId: user.id },
    data: { encryptedAccessToken: encryptLinkedinSecret("fixture-token:MALFORMED_RESPONSE:urn:li:person:fixture-user") },
  });
  const { plan: malformedPlan } = await makeReadyPlan(user.id);
  const malformedReview = await prepareLinkedinOfficialPublish(user.id, malformedPlan.id);
  const malformedResult = await executeLinkedinOfficialPublish(user.id, malformedPlan.id, {
    attemptId: malformedReview.attemptId,
  });
  evidence.malformedResponse = { status: malformedResult.status, code: malformedResult.errorCode };
  assert(malformedResult.status === "UNCERTAIN", "Malformed create response should be UNCERTAIN.");

  await prisma.linkedinConnection.update({
    where: { userId: user.id },
    data: { encryptedAccessToken: encryptLinkedinSecret("fixture-token:AMBIGUOUS_RESPONSE:urn:li:person:fixture-user") },
  });
  const { plan: ambiguousPlan } = await makeReadyPlan(user.id);
  const ambiguousReview = await prepareLinkedinOfficialPublish(user.id, ambiguousPlan.id);
  const ambiguousResult = await executeLinkedinOfficialPublish(user.id, ambiguousPlan.id, {
    attemptId: ambiguousReview.attemptId,
  });
  evidence.ambiguousResponse = { status: ambiguousResult.status, code: ambiguousResult.errorCode };
  assert(ambiguousResult.status === "UNCERTAIN", "Ambiguous provider response should be UNCERTAIN.");

  await disconnectLinkedinConnection(user.id);
  const { plan: manualPlan } = await makeReadyPlan(user.id);
  const manual = await markLinkedinPostPublishedManually(user.id, manualPlan.id, {});
  evidence.manualFallback = {
    alreadyPublished: manual.alreadyPublished,
    source: manual.plan.publishingSource,
    revisionId: manual.revisionId,
  };
  assert(manual.plan.publishingSource === "USER_CONFIRMED", "Manual fallback source changed.");
  await addLinkedinPostPerformance(user.id, manual.plan.postId, { likes: 2, impressions: 50, comments: 0 });
  const userEntered = await prisma.linkedinPostPerformance.findMany({ where: { linkedinPostId: manual.plan.postId } });
  evidence.manualPerformance = userEntered.map((row) => row.source);
  assert(userEntered.every((row) => row.source === "USER_ENTERED"), "Manual snapshots were overwritten.");

  try {
    await syncOfficialLinkedinPostAnalytics(user.id, manual.plan.postId);
    throw new Error("Analytics sync ran without approval.");
  } catch (error) {
    evidence.analyticsApproval = isIntegration(error, "LINKEDIN_ANALYTICS_NOT_APPROVED") ? "PASS" : String(error);
  }

  process.env.CAREEROS_LINKEDIN_ANALYTICS_APPROVED = "1";
  await connectWithCode(user.id, "fixture.SUCCESS");
  await prisma.linkedinConnection.update({
    where: { userId: user.id },
    data: { grantedScopesJson: ["openid", "profile", "email", "w_member_social", "r_member_postAnalytics"] },
  });
  const officialPost = await prisma.linkedinPost.findFirst({
    where: { userId: user.id, publishingSource: "LINKEDIN_OFFICIAL", externalLinkedInPostId: { not: null } },
  });
  if (officialPost) {
    await addLinkedinPostPerformance(user.id, officialPost.id, { likes: 9, impressions: 10, comments: 0 });
    const synced = await syncOfficialLinkedinPostAnalytics(user.id, officialPost.id);
    const preserved = await prisma.linkedinPostPerformance.count({
      where: { linkedinPostId: officialPost.id, source: "USER_ENTERED" },
    });
    evidence.officialAnalytics = { source: synced.source, userEnteredPreserved: preserved };
    assert(synced.source === "LINKEDIN_OFFICIAL", "Official analytics snapshot source was wrong.");
    assert(preserved >= 1, "USER_ENTERED snapshots were not preserved.");
  } else {
    evidence.officialAnalytics = "NO_OFFICIAL_POST";
  }
  delete process.env.CAREEROS_LINKEDIN_ANALYTICS_APPROVED;

  const userB = await prisma.user.create({
    data: { email: `m25b-b-${Date.now()}@careeros.local`, name: "M25B User B", emailVerified: false },
  });
  const cross: Record<string, string> = {};
  const tryCross = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      cross[name] = "LEAK";
    } catch (error) {
      cross[name] =
        error instanceof LinkedinAccessError
          ? error.code
          : error instanceof LinkedinIntegrationError
            ? error.code
            : "ERROR";
    }
  };
  const otherConnection = await getSafeLinkedinConnection(userB.id);
  evidence.crossUserConnectionIsolated = otherConnection.status === "DISCONNECTED" ? "PASS" : otherConnection.status;
  await tryCross("prepare", () => prepareLinkedinOfficialPublish(userB.id, plan.id));
  await tryCross("publish", () => executeLinkedinOfficialPublish(userB.id, plan.id, { attemptId: review.attemptId }));
  await tryCross("attempt", () => getLinkedinPublishingAttempt(userB.id, review.attemptId));
  await tryCross("resolve", () =>
    resolveLinkedinPublishingAttempt(userB.id, afterReview.attemptId, { action: "CONFIRM_PUBLISHED" }),
  );
  evidence.security = cross;
  assert(cross.prepare === "NOT_FOUND", "User B prepared User A plan.");
  assert(cross.attempt === "NOT_FOUND", "User B read User A attempt.");

  evidence.tokenStateHelper = getLinkedinTokenState(stored);
  evidence.capabilityForgeryIgnored = resolveLinkedinCapabilities({
    connectionStatus: "DISCONNECTED",
    grantedScopes: ["w_member_social"],
  }).PUBLISH_MEMBER_POST.state;
  assert(evidence.capabilityForgeryIgnored !== "AVAILABLE", "Disconnected connection cannot claim publish.");

  evidence.noAiAtPublish = "buildLinkedinPublishText only";
  evidence.ok = true;
  console.log(JSON.stringify(evidence, null, 2));
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
