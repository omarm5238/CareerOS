import "dotenv/config";

import { execSync } from "node:child_process";

import { readFileSync } from "node:fs";

import { prisma } from "@/server/db/prisma";

import { assert, cleanupFixture, counts, createFixture, createReadyAttempt } from "./m33-fixture";
import { executeExternalSubmission, issueSubmitAuthorization } from "@/features/application-execution/integrity/external-submission";
import { evidence } from "./m33-fixture";

async function main() {
  for (const script of ["scripts/m33-1-qa.ts", "scripts/m33-2-qa.ts", "scripts/m33-3-qa.ts", "scripts/m33-4-qa.ts"]) {
    execSync(`npx tsx ${script}`, { stdio: "inherit" });
  }

  const before = await counts();
  const fixture = await createFixture("m33-master");
  try {
    const ready = await createReadyAttempt(fixture);
    const versions = {
      providerAdapterVersion: "adapter-A",
      selectorStrategyVersion: "selector-A",
      confirmationStrategyVersion: "confirmation-A",
    };
    const issued = await issueSubmitAuthorization(fixture.userId, {
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
    });
    assert(issued.ok, "authorization");
    if (!issued.ok) return;
    const clicks = { n: 0 };
    const result = await executeExternalSubmission({
      userId: fixture.userId,
      attemptId: ready.attemptId,
      authorizationId: issued.authorizationId,
      token: issued.token,
      versions,
      provider: async () => {
        clicks.n += 1;
        return evidence({ clickDispatched: true, confirmationObserved: true, confirmationStrength: "DEFINITIVE", providerReference: "APP-MASTER" });
      },
    });
    assert(result.disposition === "ALREADY_FINALIZED" && clicks.n === 1, "master submit");
    await prisma.resumeSourceRevision.update({ where: { id: ready.sourceRevisionId }, data: { contentHash: "c".repeat(64) } });
    const historical = await prisma.applicationSubmissionAttempt.findUniqueOrThrow({ where: { id: ready.attemptId } });
    const pack = await prisma.applicationPackage.findUniqueOrThrow({ where: { id: ready.packageId } });
    assert(historical.providerAdapterVersion === "adapter-A", "adapter history changed");
    assert(historical.selectorStrategyVersion === "selector-A", "selector history changed");
    assert(historical.confirmationStrategyVersion === "confirmation-A", "confirmation history changed");
    assert(historical.resumeVersionRevisionId === ready.tailoredRevisionId, "tailored revision history changed");
    assert(pack.packageHash === ready.packageHash, "package history changed");
    assert(pack.sourceResumeRevisionId === ready.sourceRevisionId, "source revision binding changed");
    const outsider = await prisma.user.create({ data: { name: "m33-outsider", email: `m33-out-${Date.now()}@careeros.local` } });
    const hidden = await prisma.applicationSubmitAuthorization.findFirst({ where: { id: issued.authorizationId, userId: outsider.id } });
    assert(hidden === null, "cross-user authorization read succeeded");
    await prisma.user.delete({ where: { id: outsider.id } });
    await prisma.resumeSourceRevision.update({ where: { id: ready.sourceRevisionId }, data: { contentHash: fixture.hash } });
  } finally {
    await cleanupFixture(fixture.userId);
  }
  const after = await counts();
  assert(JSON.stringify(before) === JSON.stringify(after), `fixture rows leaked ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  const contract = readFileSync("src/features/application-execution/integrity/external-submission.ts", "utf8");
  assert(!contract.includes("click Submit again"), "resubmit fallback exists");
  console.log("m33 qa passed");
  console.log("LIVE PROVIDER CERTIFICATION PENDING");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
