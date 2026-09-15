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
import {
  completeLinkedinOAuthCallback,
  disconnectLinkedinConnection,
  getLinkedinPublishingAttempt,
  LinkedinIntegrationError,
  prepareLinkedinOfficialPublish,
  startLinkedinConnection,
} from "@/features/linkedin/server";

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

async function run() {
  const user = await getTestUser();
  await prisma.linkedinOAuthAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinPublishingAttempt.deleteMany({ where: { userId: user.id } });
  await prisma.linkedinConnection.deleteMany({ where: { userId: user.id } });

  const start = await startLinkedinConnection(user.id);
  const state = new URL(start.authorizationUrl).searchParams.get("state") ?? "";
  assert(!start.authorizationUrl.includes("fixture-secret"), "Client secret appeared in authorization URL.");
  assert(!JSON.stringify(start).toLowerCase().includes("client_secret"), "Client secret leaked from start.");

  const expiredStart = await startLinkedinConnection(user.id);
  const expiredState = new URL(expiredStart.authorizationUrl).searchParams.get("state") ?? "";
  await prisma.linkedinOAuthAttempt.update({
    where: { stateHash: hashOauthState(expiredState) },
    data: { expiresAt: new Date(Date.now() - 5000) },
  });
  const expiry = await completeLinkedinOAuthCallback(user.id, { state: expiredState, code: "fixture.SUCCESS" }).then(
    () => "LEAK",
    (error: unknown) => (error instanceof LinkedinIntegrationError ? error.code : "ERROR"),
  );
  evidence.expiredState = expiry;
  assert(expiry === "LINKEDIN_OAUTH_EXPIRED", "Expired OAuth state was accepted.");

  const wrong = await completeLinkedinOAuthCallback(user.id, { state: "not-the-state", code: "fixture.SUCCESS" }).then(
    () => "LEAK",
    (error: unknown) => (error instanceof LinkedinIntegrationError ? error.code : "ERROR"),
  );
  evidence.wrongState = wrong;
  assert(wrong === "LINKEDIN_OAUTH_STATE_INVALID", "Wrong OAuth state was accepted.");

  const userB = await prisma.user.create({
    data: { email: `m25b-sec-${Date.now()}@careeros.local`, name: "Security B", emailVerified: false },
  });
  const wrongUser = await completeLinkedinOAuthCallback(userB.id, { state, code: "fixture.SUCCESS" }).then(
    () => "LEAK",
    (error: unknown) => (error instanceof LinkedinIntegrationError ? error.code : "ERROR"),
  );
  evidence.wrongUser = wrongUser;
  assert(wrongUser === "LINKEDIN_OAUTH_STATE_INVALID", "Wrong user redeemed another user's OAuth attempt.");

  const connected = await completeLinkedinOAuthCallback(user.id, { state, code: "fixture.SUCCESS" });
  const row = await prisma.linkedinConnection.findUniqueOrThrow({ where: { userId: user.id } });
  const tokenEncrypted = {
    stored: row.encryptedAccessToken,
    rawAbsent: !JSON.stringify(connected).includes("fixture-token:"),
    dbNotRaw: row.encryptedAccessToken !== "fixture-token:SUCCESS:urn:li:person:fixture-user",
  };
  evidence.tokenEncrypted = tokenEncrypted;
  assert(tokenEncrypted.rawAbsent, "Raw token appeared in connection response.");
  assert(tokenEncrypted.dbNotRaw, "DB stored the raw fixture token.");

  const replay = await completeLinkedinOAuthCallback(user.id, { state, code: "fixture.SUCCESS" }).then(
    () => "LEAK",
    (error: unknown) => (error instanceof LinkedinIntegrationError ? error.code : "ERROR"),
  );
  evidence.replay = replay;
  assert(replay === "LINKEDIN_OAUTH_STATE_INVALID", "OAuth state replay was accepted.");

  const otherView = await prisma.linkedinConnection.findUnique({ where: { userId: userB.id } });
  evidence.crossUserConnection = otherView ? "LEAK" : "PASS";
  assert(!otherView, "User B received User A connection row.");

  const plan = await prisma.linkedinPublishingPlan.findFirst({ where: { userId: user.id } });
  if (plan) {
    const crossPrepare = await prepareLinkedinOfficialPublish(userB.id, plan.id).then(
      () => "LEAK",
      (error: unknown) => (error instanceof LinkedinAccessError ? error.code : "ERROR"),
    );
    evidence.forgedPlanAccess = crossPrepare;
    assert(crossPrepare === "NOT_FOUND", "User B prepared User A plan.");
  }

  const attempt = await prisma.linkedinPublishingAttempt.findFirst({ where: { userId: user.id } });
  if (attempt) {
    const crossAttempt = await getLinkedinPublishingAttempt(userB.id, attempt.id).then(
      () => "LEAK",
      (error: unknown) => (error instanceof LinkedinAccessError ? error.code : "ERROR"),
    );
    evidence.crossUserAttempt = crossAttempt;
    assert(crossAttempt === "NOT_FOUND", "User B read User A attempt.");
  }

  const mismatchStart = await startLinkedinConnection(user.id);
  const mismatchState = new URL(mismatchStart.authorizationUrl).searchParams.get("state") ?? "";
  const mismatch = await completeLinkedinOAuthCallback(user.id, {
    state: mismatchState,
    code: "fixture.ACCOUNT_MISMATCH",
  }).then(
    () => "LEAK",
    (error: unknown) => (error instanceof LinkedinIntegrationError ? error.code : "ERROR"),
  );
  evidence.accountMismatch = mismatch;
  assert(mismatch === "LINKEDIN_ACCOUNT_MISMATCH", "Account mismatch replaced the connection.");

  await disconnectLinkedinConnection(user.id);
  const disconnected = await prisma.linkedinConnection.findUniqueOrThrow({ where: { userId: user.id } });
  evidence.disconnectErasesToken = disconnected.encryptedAccessToken == null;
  assert(disconnected.encryptedAccessToken == null, "Disconnect did not erase the local token.");

  evidence.clientSecretHidden = !JSON.stringify(connected).includes("fixture-secret");
  const encryptionKey = process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY ?? "";
  evidence.encryptionKeyHidden = !encryptionKey || !JSON.stringify(connected).includes(encryptionKey);
  evidence.encryptRoundTrip = encryptLinkedinSecret("probe") !== "probe";
  evidence.ok = true;
  console.log(JSON.stringify(evidence, null, 2));
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
