import "dotenv/config";

import { readFileSync, readdirSync } from "node:fs";

import {
  assertAuthorizationTransition,
  assertPhaseTransition,
} from "@/features/application-execution/integrity/external-submission-contract";
import {
  cancelSubmitAuthorization,
  consumeSubmitAuthorization,
  issueSubmitAuthorization,
} from "@/features/application-execution/integrity/external-submission";
import { prisma } from "@/server/db/prisma";

import { assert, cleanupFixture, counts, createFixture, createReadyAttempt } from "./m33-fixture";

async function main() {
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert(migrations.length === 24, `expected 24 migrations, found ${migrations.length}`);
  const migration = migrations.find((entry) => entry.name.endsWith("_add_external_submission_truth"));
  assert(migration, "M33 migration is missing");
  const sql = readFileSync(`prisma/migrations/${migration.name}/migration.sql`, "utf8");
  assert(!/DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "/i.test(sql), "M33 migration is not additive");

  const legacy = await prisma.applicationSubmissionAttempt.findFirst({
    orderBy: { createdAt: "asc" },
    select: { clickAttemptStartedAt: true, clickDispatchedAt: true, confirmationObservedAt: true, externalPhase: true },
  });
  if (legacy) {
    assert(legacy.clickAttemptStartedAt === null, "legacy click evidence was fabricated");
    assert(legacy.clickDispatchedAt === null, "legacy dispatch evidence was fabricated");
    assert(legacy.confirmationObservedAt === null, "legacy confirmation evidence was fabricated");
    assert(legacy.externalPhase === null, "legacy phase was fabricated");
  }

  let illegal = false;
  try {
    assertAuthorizationTransition("CONSUMED", "ISSUED");
  } catch {
    illegal = true;
  }
  assert(illegal, "consumed authorization returned to issued");
  illegal = false;
  try {
    assertPhaseTransition("LOCAL_FINALIZATION_COMPLETED", "CLICK_DISPATCHED");
  } catch {
    illegal = true;
  }
  assert(illegal, "illegal phase transition was accepted");

  const before = await counts();
  const fixture = await createFixture("m33-1");
  const other = await prisma.user.create({ data: { name: "m33-1-other", email: `m33-1-other-${Date.now()}@careeros.local` } });
  try {
    const ready = await createReadyAttempt(fixture);
    const issued = await issueSubmitAuthorization(fixture.userId, {
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
    });
    assert(issued.ok, "authorization was not issued");
    if (!issued.ok) return;
    const mismatch = await consumeSubmitAuthorization({
      authorizationId: issued.authorizationId,
      token: issued.token,
      userId: other.id,
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
      provider: "UNKNOWN",
      targetHost: "127.0.0.1",
      targetJobId: null,
    });
    assert(!mismatch.ok && mismatch.reason === "CROSS_USER", mismatch.ok ? "" : mismatch.reason);

    const wrongPackage = await consumeSubmitAuthorization({
      authorizationId: issued.authorizationId,
      token: issued.token,
      userId: fixture.userId,
      applicationId: ready.applicationId,
      packageId: "wrong-package",
      attemptId: ready.attemptId,
      provider: "UNKNOWN",
      targetHost: "127.0.0.1",
      targetJobId: null,
    });
    assert(!wrongPackage.ok && wrongPackage.reason === "BINDING_MISMATCH", wrongPackage.ok ? "" : wrongPackage.reason);

    const auth = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: issued.authorizationId } });
    const consumed = await consumeSubmitAuthorization({
      authorizationId: issued.authorizationId,
      token: issued.token,
      userId: fixture.userId,
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
      provider: auth.provider,
      targetHost: auth.targetHost,
      targetJobId: auth.targetJobId,
    });
    assert(consumed.ok, consumed.ok ? "" : consumed.reason);
    const again = await consumeSubmitAuthorization({
      authorizationId: issued.authorizationId,
      token: issued.token,
      userId: fixture.userId,
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
      provider: auth.provider,
      targetHost: auth.targetHost,
      targetJobId: auth.targetJobId,
    });
    assert(!again.ok, "consumed authorization was reused");

    const events = await prisma.applicationExecutionEvent.findMany({
      where: { executionSessionId: ready.sessionId!, type: "SUBMIT_AUTHORIZATION_ISSUED" },
    });
    assert(events.length === 1, "authorization event was not appended once");
    const original = events[0]?.message;
    await issueSubmitAuthorization(fixture.userId, {
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
    }).catch(() => undefined);
    const reread = await prisma.applicationExecutionEvent.findUniqueOrThrow({ where: { id: events[0]!.id } });
    assert(reread.message === original, "journal event was rewritten");

    const second = await createReadyAttempt(fixture);
    const parallel = await Promise.all([
      issueSubmitAuthorization(fixture.userId, { applicationId: second.applicationId, packageId: second.packageId, attemptId: second.attemptId }),
      issueSubmitAuthorization(fixture.userId, { applicationId: second.applicationId, packageId: second.packageId, attemptId: second.attemptId }),
    ]);
    assert(parallel.filter((item) => item.ok).length === 1, "concurrent authorization issuance was not single-use");

    const third = await createReadyAttempt(fixture);
    const expiring = await issueSubmitAuthorization(fixture.userId, {
      applicationId: third.applicationId,
      packageId: third.packageId,
      attemptId: third.attemptId,
    });
    assert(expiring.ok, "expiring authorization was not issued");
    if (!expiring.ok) return;
    await prisma.applicationSubmitAuthorization.update({
      where: { id: expiring.authorizationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredAuth = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: expiring.authorizationId } });
    const expired = await consumeSubmitAuthorization({
      authorizationId: expiring.authorizationId,
      token: expiring.token,
      userId: fixture.userId,
      applicationId: third.applicationId,
      packageId: third.packageId,
      attemptId: third.attemptId,
      provider: expiredAuth.provider,
      targetHost: expiredAuth.targetHost,
      targetJobId: expiredAuth.targetJobId,
    });
    assert(!expired.ok && expired.reason === "AUTHORIZATION_EXPIRED", expired.ok ? "" : expired.reason);

    const fourth = await createReadyAttempt(fixture);
    const cancellable = await issueSubmitAuthorization(fixture.userId, {
      applicationId: fourth.applicationId,
      packageId: fourth.packageId,
      attemptId: fourth.attemptId,
    });
    assert(cancellable.ok, "cancellable authorization was not issued");
    if (!cancellable.ok) return;
    assert(await cancelSubmitAuthorization(fixture.userId, cancellable.authorizationId), "authorization was not cancelled");
    const cancelledAuth = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: cancellable.authorizationId } });
    const cancelled = await consumeSubmitAuthorization({
      authorizationId: cancellable.authorizationId,
      token: cancellable.token,
      userId: fixture.userId,
      applicationId: fourth.applicationId,
      packageId: fourth.packageId,
      attemptId: fourth.attemptId,
      provider: cancelledAuth.provider,
      targetHost: cancelledAuth.targetHost,
      targetJobId: cancelledAuth.targetJobId,
    });
    assert(!cancelled.ok && cancelled.reason === "AUTHORIZATION_CANCELLED", cancelled.ok ? "" : cancelled.reason);
    assert(!(await cancelSubmitAuthorization(other.id, cancellable.authorizationId)), "cross-user cancel succeeded");
  } finally {
    await cleanupFixture(fixture.userId);
    await prisma.user.delete({ where: { id: other.id } });
  }

  const after = await counts();
  assert(JSON.stringify(before) === JSON.stringify(after), `fixture rows leaked ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  console.log("m33-1 qa passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
