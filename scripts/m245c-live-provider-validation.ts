import "dotenv/config";

process.env.CAREEROS_BROWSER_HEADLESS = "1";
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.USERPROFILE) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = `${process.env.USERPROFILE}\\AppData\\Local\\ms-playwright`;
}

import { closeAllBrowserRuntimes } from "@/features/application-execution/server";
import { getApplicationBrowserRunner } from "@/features/application-execution/browser/browser-runtime-registry";
import { detectProvider, selectAdapter } from "@/features/application-execution/adapters/adapter-registry";
import { inspectWithRoot } from "@/features/application-execution/adapters/application-execution-adapter";
import { pickTrustedAction } from "@/features/application-execution/classification/classify-application-action";
import { isSafeOpenApplicationHref } from "@/features/application-execution/form/safe-open-application";
import { getProviderCapability } from "@/features/application-execution/adapters/provider-submission-capabilities";
import { computeRuntimeSubmissionCapability } from "@/features/application-execution/submission/runtime-submission-capability";

const PAGES: Array<{ provider: "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE" | "SMARTRECRUITERS"; url: string }> = [
  { provider: "GREENHOUSE", url: "https://boards.greenhouse.io/spacex/jobs/8696097002" },
  { provider: "LEVER", url: "https://jobs.lever.co/cgsfederal/a509da73-35a1-4ab7-a08d-f5e5fba7294b/apply" },
  { provider: "ASHBY", url: "https://jobs.ashbyhq.com/render/558f18ed-c98c-4928-aa2b-2f9e297eea42" },
  { provider: "WORKABLE", url: "https://apply.workable.com/gramian/j/1D171AB54B/apply" },
  { provider: "SMARTRECRUITERS", url: "https://jobs.smartrecruiters.com/asos/744000146975620" },
];

type LiveResult = {
  expected: string;
  url: string;
  finalUrl: string | null;
  detected: string | null;
  confidence: number | null;
  formRoot: boolean | null;
  fieldCount: number | null;
  representative: Array<{ label: string; type: string; required: boolean; classification: string }>;
  documentFields: string[];
  legalOrSensitive: string[];
  consent: string[];
  captcha: boolean | null;
  openApplication: { label: string; action: string; trusted: boolean } | null;
  clickedOpenApplication: boolean;
  finalSubmit: { label: string; trusted: boolean; confidence: number } | null;
  clickedSubmit: false;
  uploadedResume: false;
  acceptedConsent: false;
  interruption: string | null;
  verificationSignals: string[];
  runtimeConfirmedSubmit: boolean | null;
  enablement: "ENABLED" | "DISABLED";
  enablementReason: string;
  outcome: "LIVE_VERIFIED" | "LIVE_PARTIAL" | "FALLBACK_VERIFIED" | "BLOCKED_BY_PROVIDER" | "NOT_FOUND";
  error: string | null;
};

async function inspectOne(expected: LiveResult["expected"], url: string): Promise<LiveResult> {
  const result: LiveResult = {
    expected,
    url,
    finalUrl: null,
    detected: null,
    confidence: null,
    formRoot: null,
    fieldCount: null,
    representative: [],
    documentFields: [],
    legalOrSensitive: [],
    consent: [],
    captcha: null,
    openApplication: null,
    clickedOpenApplication: false,
    finalSubmit: null,
    clickedSubmit: false,
    uploadedResume: false,
    acceptedConsent: false,
    interruption: null,
    verificationSignals: [],
    runtimeConfirmedSubmit: null,
    enablement: "DISABLED",
    enablementReason: "Public live inspection only. No sandbox/test tenant submit.",
    outcome: "NOT_FOUND",
    error: null,
  };
  const runner = getApplicationBrowserRunner();
  const sessionId = `m245c-live-${expected.toLowerCase()}`;
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
    let detection = await detectProvider(page);
    result.detected = detection.provider;
    result.confidence = detection.confidence;
    let survey = await inspectWithRoot(page, detection.provider, "body");
    const open = pickTrustedAction(survey.actions, "OPEN_APPLICATION");
    const openAny = survey.actions.find((item) => item.action === "OPEN_APPLICATION");
    result.openApplication = openAny
      ? { label: openAny.label, action: openAny.action, trusted: openAny.trusted }
      : open
        ? { label: open.label, action: open.action, trusted: open.trusted }
        : null;
    if (
      open &&
      survey.fields.length < 3 &&
      pickTrustedAction(survey.actions, "FINAL_SUBMIT") == null &&
      (await isSafeOpenApplicationHref(page, open.selector.value, detection.provider))
    ) {
      await page.click(open.selector.value);
      result.clickedOpenApplication = true;
      await page.waitForTimeout(3500);
      result.finalUrl = page.url();
      detection = await detectProvider(page);
      result.detected = detection.provider;
      result.confidence = detection.confidence;
      survey = await inspectWithRoot(page, detection.provider, "body");
    }
    const adapter = selectAdapter(detection.provider, false);
    const interruption = await adapter.detectInterruptions(page);
    result.interruption = interruption.kind;
    const signals = await page.contentSignals();
    result.captcha = Boolean(signals.hasCaptcha || signals.hasChallengeFrame || interruption.kind === "CAPTCHA");
    if (/recaptcha|hcaptcha|turnstile/i.test(signals.bodyTextSample) || signals.hasCaptcha) {
      result.verificationSignals.push("captcha-or-challenge-present");
    }
    try {
      const snapshot = await adapter.inspect(page);
      result.formRoot = snapshot.fields.length >= 3;
      result.fieldCount = snapshot.fields.length;
      result.representative = snapshot.fields.slice(0, 8).map((field) => ({
        label: field.label.slice(0, 80),
        type: field.type,
        required: field.required,
        classification: field.classification,
      }));
      result.documentFields = snapshot.fields.filter((field) => field.classification === "DOCUMENT").map((field) => field.label.slice(0, 80));
      result.legalOrSensitive = snapshot.fields
        .filter((field) => field.classification === "LEGAL" || field.classification === "SENSITIVE")
        .map((field) => `${field.classification}:${field.label.slice(0, 60)}`);
      result.consent = snapshot.fields.filter((field) => field.classification === "CONSENT").map((field) => field.label.slice(0, 60));
      const final = (snapshot.actions ?? []).find((item) => item.action === "FINAL_SUBMIT");
      result.finalSubmit = final ? { label: final.label, trusted: final.trusted, confidence: final.confidence } : snapshot.submitControl
        ? { label: snapshot.submitControl.label, trusted: snapshot.submitControl.confidence >= 0.85, confidence: snapshot.submitControl.confidence }
        : null;
      if (snapshot.submitControl) result.verificationSignals.push(`submit:${snapshot.submitControl.label}`);
      const runtime = computeRuntimeSubmissionCapability({
        provider: detection.provider,
        detection,
        snapshot,
        actions: snapshot.actions ?? [],
        interruption: interruption.kind,
        drifted: false,
        unsupportedWidget: snapshot.fields.some((field) => field.type === "OTHER" && field.confidence < 0.5),
        formFingerprintStable: true,
        reviewComplete: false,
      });
      result.runtimeConfirmedSubmit = runtime.confirmedBrowserSubmit;
      const capability = getProviderCapability(detection.provider);
      result.enablement = capability.confirmedBrowserSubmitEligible ? "ENABLED" : "DISABLED";
      result.enablementReason = capability.knownLimitations[0] ?? result.enablementReason;
      const expectedMatch = detection.provider === expected;
      if (expectedMatch && snapshot.fields.length >= 3) result.outcome = "LIVE_VERIFIED";
      else if (expectedMatch) result.outcome = "LIVE_PARTIAL";
      else if (interruption.kind === "LOGIN" || interruption.kind === "CAPTCHA" || interruption.kind === "MFA" || interruption.kind === "ASSESSMENT") {
        result.outcome = "BLOCKED_BY_PROVIDER";
      } else result.outcome = "LIVE_PARTIAL";
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
      if (code === "ADAPTER_DRIFT" || (error instanceof Error && error.message === "ADAPTER_DRIFT")) {
        const generic = selectAdapter("GENERIC", true);
        const snapshot = await generic.inspect(page);
        result.fieldCount = snapshot.fields.length;
        result.formRoot = false;
        result.representative = snapshot.fields.slice(0, 8).map((field) => ({
          label: field.label.slice(0, 80),
          type: field.type,
          required: field.required,
          classification: field.classification,
        }));
        result.runtimeConfirmedSubmit = false;
        result.enablement = "DISABLED";
        if (snapshot.fields.length >= 3) result.outcome = "FALLBACK_VERIFIED";
        else if (interruption.kind === "LOGIN" || interruption.kind === "CAPTCHA" || interruption.kind === "MFA") result.outcome = "BLOCKED_BY_PROVIDER";
        else result.outcome = "LIVE_PARTIAL";
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
  const results: LiveResult[] = [];
  for (const page of PAGES) {
    results.push(await inspectOne(page.provider, page.url));
  }
  console.log(
    JSON.stringify(
      {
        clickedSubmit: false,
        uploadedResume: false,
        acceptedConsent: false,
        solvedCaptcha: false,
        createdExternalAccount: false,
        results,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllBrowserRuntimes().catch(() => undefined);
  });
