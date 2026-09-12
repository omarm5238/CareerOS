import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { detectProviderPageBlock } from "../classification/detect-provider-page-block";
import { applyLiveValue } from "../form/apply-live-value";
import { buildFormFingerprint } from "../form/form-fingerprint";
import { ExecutionAccessError } from "../lib/permissions";
import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import type { FillPlan } from "../types";
import { buildFinalReview } from "./build-final-submission-snapshot";
import { computeRuntimeSubmissionCapability } from "./runtime-submission-capability";

export async function readLiveSubmissionState(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const page = getApplicationBrowserRunner().getPage(sessionId);
  if (!page) throw new ExecutionAccessError("CONFLICT", "Browser is not connected.");
  const drifted = row.provider === "GENERIC" || JSON.stringify(row.warningsJson).includes("ADAPTER_DRIFT");
  const adapter = selectAdapter(row.provider, drifted);
  const interruption = await adapter.detectInterruptions(page);
  const signals = await page.contentSignals();
  const block = detectProviderPageBlock(`${signals.url} ${signals.title} ${signals.bodyTextSample}`);
  const snapshot = await adapter.inspect(page);
  snapshot.provider = row.provider;
  const fingerprint = buildFormFingerprint(snapshot, row.jobPostingId);
  const previous = sessionJson(row);
  const plan: FillPlan = {
    ...previous.plan,
    answers: previous.plan.answers.map((answer) => {
      const field = snapshot.fields.find((item) => item.externalId === answer.fieldId);
      return field ? applyLiveValue(answer, field) ?? answer : answer;
    }),
  };
  const reviewComplete = buildFinalReview(row, snapshot, plan).unresolved.length === 0;
  const runtimeCapability = computeRuntimeSubmissionCapability({
    provider: row.provider,
    detection: { confidence: previous.plan.detectionConfidence ?? 0.99, drifted, cautious: false },
    snapshot,
    actions: snapshot.actions ?? [],
    interruption: interruption.kind,
    drifted,
    unsupportedWidget: snapshot.fields.some((field) => field.type === "OTHER" && field.confidence < 0.5),
    formFingerprintStable: !row.formFingerprint || row.formFingerprint === fingerprint,
    reviewComplete,
  });
  plan.runtimeCapability = runtimeCapability;
  return { row, page, adapter, snapshot, plan, fingerprint, interruption, block, runtimeCapability, drifted };
}
