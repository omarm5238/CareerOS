import "dotenv/config";

import { getApplicationBrowserRunner } from "@/features/application-execution/browser/browser-runtime-registry";
import { detectProvider, selectAdapter } from "@/features/application-execution/adapters/adapter-registry";
import { closeAllBrowserRuntimes } from "@/features/application-execution/server";

const PAGES: Array<{ provider: string; url: string }> = [
  { provider: "GREENHOUSE", url: "https://boards.greenhouse.io/spacex/jobs/8696097002" },
  { provider: "LEVER", url: "https://jobs.lever.co/cgsfederal/a509da73-35a1-4ab7-a08d-f5e5fba7294b/apply" },
  { provider: "ASHBY", url: "https://jobs.ashbyhq.com/render/558f18ed-c98c-4928-aa2b-2f9e297eea42" },
  { provider: "WORKABLE", url: "https://apply.workable.com/gramian/j/1D171AB54B/apply" },
  { provider: "SMARTRECRUITERS", url: "https://jobs.smartrecruiters.com/asos/744000146975620" },
];

type SmokeResult = {
  expected: string;
  url: string;
  finalUrl: string | null;
  detected: string | null;
  confidence: number | null;
  reasons: string[];
  fieldCount: number | null;
  representative: Array<{ label: string; type: string; required: boolean; classification: string }>;
  documentFields: string[];
  legalOrSensitive: string[];
  submitControl: string | null;
  interruption: string | null;
  dedicatedDrift: boolean;
  usedGeneric: boolean;
  outcome: string;
  error: string | null;
  clickedSubmit: false;
};

async function smokeOne(expected: string, url: string): Promise<SmokeResult> {
  const result: SmokeResult = {
    expected,
    url,
    finalUrl: null,
    detected: null,
    confidence: null,
    reasons: [],
    fieldCount: null,
    representative: [],
    documentFields: [],
    legalOrSensitive: [],
    submitControl: null,
    interruption: null,
    dedicatedDrift: false,
    usedGeneric: false,
    outcome: "NOT_FOUND",
    error: null,
    clickedSubmit: false,
  };
  const runner = getApplicationBrowserRunner();
  const sessionId = `live-smoke-${expected.toLowerCase()}`;
  try {
    await runner.launch(sessionId);
    await runner.navigate(sessionId, url);
    const page = runner.getPage(sessionId);
    if (!page) {
      result.outcome = "BLOCKED_BY_PROVIDER";
      result.error = "Browser page missing.";
      return result;
    }
    await page.waitForTimeout(4000);
    result.finalUrl = page.url();
    const detection = await detectProvider(page);
    result.detected = detection.provider;
    result.confidence = detection.confidence;
    result.reasons = detection.reasons;
    const adapter = selectAdapter(detection.provider, false);
    const interruption = await adapter.detectInterruptions(page);
    result.interruption = interruption.kind;
    try {
      const snapshot = await adapter.inspect(page);
      result.fieldCount = snapshot.fields.length;
      result.submitControl = snapshot.submitControl?.label ?? null;
      result.representative = snapshot.fields.slice(0, 8).map((field) => ({
        label: field.label.slice(0, 80),
        type: field.type,
        required: field.required,
        classification: field.classification,
      }));
      result.documentFields = snapshot.fields.filter((field) => field.classification === "DOCUMENT").map((field) => field.label.slice(0, 80));
      result.legalOrSensitive = snapshot.fields
        .filter((field) => field.classification === "LEGAL" || field.classification === "SENSITIVE" || field.classification === "CONSENT")
        .map((field) => `${field.classification}:${field.label.slice(0, 60)}`);
      const detectedExpected = detection.provider === expected;
      if (detectedExpected && snapshot.fields.length >= 3) result.outcome = "LIVE_VERIFIED";
      else if (detectedExpected) result.outcome = "LIVE_PARTIAL";
      else if (snapshot.fields.length > 0) result.outcome = "LIVE_PARTIAL";
      else if (interruption.kind === "LOGIN" || interruption.kind === "CAPTCHA" || interruption.kind === "MFA" || interruption.kind === "ASSESSMENT" || interruption.kind === "CHALLENGE_FRAME") {
        result.outcome = "BLOCKED_BY_PROVIDER";
      } else result.outcome = "LIVE_PARTIAL";
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
      if (code === "ADAPTER_DRIFT" || (error instanceof Error && error.message === "ADAPTER_DRIFT")) {
        result.dedicatedDrift = true;
        const generic = selectAdapter("GENERIC", true);
        result.usedGeneric = true;
        const snapshot = await generic.inspect(page);
        result.fieldCount = snapshot.fields.length;
        result.submitControl = snapshot.submitControl?.label ?? null;
        result.representative = snapshot.fields.slice(0, 8).map((field) => ({
          label: field.label.slice(0, 80),
          type: field.type,
          required: field.required,
          classification: field.classification,
        }));
        result.documentFields = snapshot.fields.filter((field) => field.classification === "DOCUMENT").map((field) => field.label.slice(0, 80));
        result.legalOrSensitive = snapshot.fields
          .filter((field) => field.classification === "LEGAL" || field.classification === "SENSITIVE" || field.classification === "CONSENT")
          .map((field) => `${field.classification}:${field.label.slice(0, 60)}`);
        if (snapshot.fields.length >= 3) result.outcome = "FALLBACK_VERIFIED";
        else if (detection.provider === expected) result.outcome = "LIVE_PARTIAL";
        else if (interruption.kind === "LOGIN" || interruption.kind === "CAPTCHA" || interruption.kind === "MFA" || interruption.kind === "ASSESSMENT") {
          result.outcome = "BLOCKED_BY_PROVIDER";
        } else result.outcome = "LIVE_PARTIAL";
      } else {
        throw error;
      }
    }
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.outcome = /timeout|net::|403|401/i.test(result.error) ? "BLOCKED_BY_PROVIDER" : "NOT_FOUND";
    return result;
  } finally {
    await runner.close(sessionId);
  }
}

async function run() {
  const results: SmokeResult[] = [];
  for (const page of PAGES) {
    results.push(await smokeOne(page.provider, page.url));
  }
  console.log(JSON.stringify({ clickedSubmit: false, uploadedResume: false, acceptedConsent: false, results }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllBrowserRuntimes().catch(() => undefined);
  });
