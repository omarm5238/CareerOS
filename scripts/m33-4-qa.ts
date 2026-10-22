import "dotenv/config";

import { readFileSync } from "node:fs";

import { rejectClientTarget } from "@/features/application-execution/integrity/submission-request";
import {
  attemptLiveProviderSubmit,
  certifyDryRun,
  evaluateLiveSubmitGate,
  liveProviderInvocationCount,
  liveSubmitEnabled,
  resetLiveProviderInvocations,
} from "@/features/application-execution/integrity/live-submit-policy";
import { prisma } from "@/server/db/prisma";

import { assert, cleanupFixture, counts, createFixture, createReadyAttempt } from "./m33-fixture";
import { issueSubmitAuthorization, recordDryRunCertification } from "@/features/application-execution/integrity/external-submission";

const baseGate = {
  provider: "GREENHOUSE",
  host: "boards.example",
  jobId: "job-1",
  destination: "https://boards.example/jobs/job-1",
  applicationId: "app-1",
  expectedApplicationId: "app-1",
  packageId: "pkg-1",
  expectedPackageId: "pkg-1",
  authorizationState: "ISSUED" as const,
  authorizationExpired: false,
  dryRunStatus: "DRY_RUN_CERTIFIED",
};

async function main() {
  const previousEnabled = process.env.LIVE_PROVIDER_SUBMIT_ENABLED;
  const previousAllow = process.env.CAREEROS_LIVE_SUBMIT_ALLOWLIST;
  delete process.env.LIVE_PROVIDER_SUBMIT_ENABLED;
  delete process.env.CAREEROS_LIVE_SUBMIT_ALLOWLIST;
  resetLiveProviderInvocations();
  try {
    assert(liveSubmitEnabled() === false, "live submit is enabled by default");
    const disabled = await attemptLiveProviderSubmit(baseGate, async () => undefined);
    assert(!disabled.allowed && disabled.reason === "LIVE_SUBMIT_DISABLED" && liveProviderInvocationCount() === 0, "disabled live submit called the provider");

    process.env.LIVE_PROVIDER_SUBMIT_ENABLED = "true";
    const unapproved = evaluateLiveSubmitGate(baseGate);
    assert(!unapproved.allowed && unapproved.reason === "TARGET_NOT_ALLOWLISTED", unapproved.allowed ? "" : unapproved.reason);
    process.env.CAREEROS_LIVE_SUBMIT_ALLOWLIST = "GREENHOUSE|boards.example|job-1|https://boards.example/jobs/job-1";
    assert(!evaluateLiveSubmitGate({ ...baseGate, provider: "LEVER" }).allowed, "unapproved provider");
    assert(!evaluateLiveSubmitGate({ ...baseGate, host: "evil.example" }).allowed, "unapproved host");
    assert(!evaluateLiveSubmitGate({ ...baseGate, destination: "https://boards.example/jobs/other" }).allowed, "unapproved destination");
    assert(!evaluateLiveSubmitGate({ ...baseGate, jobId: "job-2" }).allowed, "wrong job");
    assert(!evaluateLiveSubmitGate({ ...baseGate, applicationId: "app-2" }).allowed, "wrong application");
    assert(!evaluateLiveSubmitGate({ ...baseGate, packageId: "pkg-2" }).allowed, "wrong package");
    assert(!evaluateLiveSubmitGate({ ...baseGate, authorizationState: "EXPIRED", authorizationExpired: true }).allowed, "expired authorization");
    assert(!evaluateLiveSubmitGate({ ...baseGate, authorizationState: "CONSUMED" }).allowed, "consumed authorization");
    assert(!evaluateLiveSubmitGate({ ...baseGate, dryRunStatus: null }).allowed, "missing dry run");
    assert(!evaluateLiveSubmitGate({ ...baseGate, dryRunStatus: "DRY_RUN_FAILED" }).allowed, "failed dry run");
    assert(certifyDryRun({
      employerMatches: true,
      jobMatches: true,
      providerMatches: true,
      destinationMatches: true,
      packageMatches: true,
      resumeRevisionMatches: true,
      answersPresent: true,
      submitControlLocated: true,
      confirmationStrategyPresent: true,
      stoppedBeforeFinalSubmit: false,
    }) === "DRY_RUN_FAILED", "dry run that clicked submit was certified");
    assert(certifyDryRun({
      employerMatches: true,
      jobMatches: true,
      providerMatches: true,
      destinationMatches: true,
      packageMatches: true,
      resumeRevisionMatches: true,
      answersPresent: true,
      submitControlLocated: true,
      confirmationStrategyPresent: true,
      stoppedBeforeFinalSubmit: true,
    }) === "DRY_RUN_CERTIFIED", "complete dry run was rejected");
    const allowed = evaluateLiveSubmitGate(baseGate);
    assert(allowed.allowed, "allowlisted dry-run target was blocked");
    const first = await attemptLiveProviderSubmit(baseGate, async () => undefined);
    assert(first.allowed && liveProviderInvocationCount() === 1, "allowlisted send did not run once");
    const second = await attemptLiveProviderSubmit({ ...baseGate, authorizationState: "CONSUMED" }, async () => undefined);
    assert(!second.allowed && liveProviderInvocationCount() === 1, "one authorization live-submitted twice");
    assert(liveProviderInvocationCount() === 1, `live invocations ${liveProviderInvocationCount()}`);

    const rejected = rejectClientTarget({ url: "https://evil.example/apply" });
    assert(rejected?.status === 400, "client target URL was accepted");
    const executeSource = readFileSync("src/app/api/applications/[applicationId]/submission/execute/route.ts", "utf8");
    assert(!executeSource.includes("body.url") && !executeSource.includes("body.destination"), "execute route trusts a client URL");
    assert(executeSource.includes("LIVE_ADAPTER_NOT_CONFIGURED"), "execute route can reach a provider");
  } finally {
    if (previousEnabled === undefined) delete process.env.LIVE_PROVIDER_SUBMIT_ENABLED;
    else process.env.LIVE_PROVIDER_SUBMIT_ENABLED = previousEnabled;
    if (previousAllow === undefined) delete process.env.CAREEROS_LIVE_SUBMIT_ALLOWLIST;
    else process.env.CAREEROS_LIVE_SUBMIT_ALLOWLIST = previousAllow;
    resetLiveProviderInvocations();
  }

  const before = await counts();
  const fixture = await createFixture("m33-4");
  try {
    const ready = await createReadyAttempt(fixture);
    const issued = await issueSubmitAuthorization(fixture.userId, {
      applicationId: ready.applicationId,
      packageId: ready.packageId,
      attemptId: ready.attemptId,
    });
    assert(issued.ok, "authorization");
    if (!issued.ok) return;
    assert(await recordDryRunCertification(fixture.userId, issued.authorizationId, "DRY_RUN_FAILED"), "dry run was not recorded");
    const row = await prisma.applicationSubmitAuthorization.findUniqueOrThrow({ where: { id: issued.authorizationId } });
    assert(row.dryRunStatus === "DRY_RUN_FAILED" && row.state === "ISSUED", "failed dry run consumed the authorization");
    const audit = readFileSync("src/features/application-execution/components/external-submission-panel.tsx", "utf8");
    assert(audit.includes("The submit action may have reached the employer."), "uncertain copy missing");
    assert(audit.includes("CareerOS will not submit this application again automatically."), "no-resubmit copy missing");
    assert(audit.includes("canRetry"), "retry is not permissioned");
  } finally {
    await cleanupFixture(fixture.userId);
  }
  const after = await counts();
  assert(JSON.stringify(before) === JSON.stringify(after), `fixture rows leaked ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  console.log("m33-4 qa passed");
  console.log("live provider certification pending");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
