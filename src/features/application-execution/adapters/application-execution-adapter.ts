import type { ApplicationProvider } from "@/generated/prisma/client";

import { classifyApplicationField, detectDocumentKind, normalizeLabel } from "../classification/classify-application-field";
import { classifyPageActions, pickTrustedAction } from "../classification/classify-application-action";
import { detectInterruptionsFromDom } from "../classification/detect-interruptions";
import { detectProviderPageBlock } from "../classification/detect-provider-page-block";
import type { ApplicationBrowserPage, ApplicationExecutionAdapter, UploadedFileSpec } from "../browser/application-browser-runner";
import { getProviderCapability } from "./provider-submission-capabilities";
import { isConfirmedSubmitEnabledForProvider } from "./confirmed-submit-policy";
import { foreignSuccessMarkerPresent, verificationProfileFor } from "./provider-verification-profiles";
import type { AdapterCapabilities, ApplicationFormSnapshot } from "../types";
import type { RawInspectResult } from "./inspect-dom";
import { inspectDomSource } from "./inspect-dom";

const HOST_HINTS: Array<{ provider: ApplicationProvider; re: RegExp }> = [
  { provider: "GREENHOUSE", re: /greenhouse\.io|grnh\.se/i },
  { provider: "LEVER", re: /lever\.co/i },
  { provider: "ASHBY", re: /ashbyhq\.com/i },
  { provider: "WORKABLE", re: /workable\.com/i },
  { provider: "SMARTRECRUITERS", re: /smartrecruiters\.com/i },
];

export function hostnameProvider(url: string): { provider: ApplicationProvider; confidence: number } | null {
  for (const hint of HOST_HINTS) {
    if (hint.re.test(url)) return { provider: hint.provider, confidence: 0.82 };
  }
  return null;
}

export async function inspectWithRoot(
  page: ApplicationBrowserPage,
  provider: ApplicationProvider,
  rootSelector: string | null,
): Promise<ApplicationFormSnapshot> {
      const raw = await page.evaluateExpression<RawInspectResult>(
    `(${inspectDomSource})(${JSON.stringify(rootSelector)})`,
  );
  const fields = raw.fields
    .filter((field) => !field.hidden)
    .map((field) => {
      const classified = classifyApplicationField({ label: field.label, type: field.type, name: field.externalId });
      const live = field.currentValue?.trim() ?? "";
      return {
        externalId: field.externalId,
        selector: { strategy: "css" as const, value: field.selector },
        label: field.label,
        normalizedLabel: normalizeLabel(field.label),
        type: field.unsupported ? ("OTHER" as const) : field.type,
        required: field.required,
        options: field.options,
        step: raw.step,
        classification: classified.classification,
        confidence: field.unsupported ? 0.2 : classified.confidence,
        currentValueState: live ? ("filled" as const) : ("empty" as const),
        currentValuePreview: live || null,
        documentKind: detectDocumentKind(field.label),
      };
    });
  const actions = classifyPageActions(raw.actions ?? []);
  const final = pickTrustedAction(actions, "FINAL_SUBMIT");
  const next = pickTrustedAction(actions, "NEXT_STEP") ?? pickTrustedAction(actions, "SAVE_AND_CONTINUE");
  const open = pickTrustedAction(actions, "OPEN_APPLICATION");

  return {
    provider,
    pageUrl: page.url(),
    step: raw.step,
    totalSteps: raw.totalSteps,
    fields,
    submitControl: final
      ? { selector: final.selector, label: final.label, isFinal: true, confidence: final.confidence }
      : raw.submitSelector
        ? { selector: { strategy: "css", value: raw.submitSelector }, label: raw.submitLabel ?? "Submit", isFinal: true, confidence: 0.6 }
      : null,
    nextControl: next
      ? { selector: next.selector, label: next.label, isFinal: false, confidence: next.confidence }
      : raw.nextSelector
        ? { selector: { strategy: "css", value: raw.nextSelector }, label: raw.nextLabel ?? "Next", isFinal: false, confidence: 0.6 }
        : null,
    openApplicationControl: open
      ? { selector: open.selector, label: open.label, isFinal: false, confidence: open.confidence }
      : raw.openSelector
        ? { selector: { strategy: "css", value: raw.openSelector }, label: raw.openLabel ?? "Apply", isFinal: false, confidence: 0.6 }
        : null,
    actions,
    inspectedAt: new Date().toISOString(),
  };
}

export async function fillOnPage(
  page: ApplicationBrowserPage,
  selector: string,
  type: string,
  value: string | boolean,
): Promise<void> {
  if (type === "CHECKBOX") {
    await page.check(selector, value === true || value === "true");
    return;
  }
  if (type === "SELECT") {
    await page.selectOption(selector, String(value));
    return;
  }
  if (type === "RADIO") {
    await page.click(`${selector}[value="${String(value)}"], ${selector}`);
    return;
  }
  await page.fill(selector, String(value));
}

export function createBrowserAdapter(options: {
  provider: ApplicationProvider;
  rootSelectors: string[];
  dataAts: string;
  successMarker: string;
  errorMarker: string;
  confirmedBrowserSubmit: boolean;
  version?: string;
  extraDetect?: (url: string, htmlMarkers: string[]) => number;
}): ApplicationExecutionAdapter {
  const version = options.version ?? getProviderCapability(options.provider).adapterVersion;
  const capabilities = (): AdapterCapabilities => ({
    inspectForm: true,
    fillFields: true,
    uploadFiles: true,
    multiStep: true,
    detectLogin: true,
    detectCaptcha: true,
    detectAssessment: true,
    confirmedBrowserSubmit:
      options.provider === "GENERIC" || options.provider === "UNKNOWN"
        ? false
        : isConfirmedSubmitEnabledForProvider(options.provider),
    verificationStrength: options.provider === "GENERIC" || options.provider === "UNKNOWN" ? "generic" : "provider",
    officialApiSubmit: false,
  });

  return {
    provider: options.provider,
    version,
    capabilities,
    async detect(page) {
      const url = page.url();
      const signals = await page.contentSignals();
      const reasons: string[] = [];
      let confidence = 0;
      const ats = signals.markers.some((marker) => marker.toLowerCase().includes(options.dataAts));
      if (ats) {
        confidence = 0.99;
        reasons.push(`data-ats=${options.dataAts}`);
      }
      const host = hostnameProvider(url);
      if (host?.provider === options.provider) {
        confidence = Math.max(confidence, host.confidence);
        reasons.push("hostname");
      }
      if (options.extraDetect) {
        const extra = options.extraDetect(url, signals.markers);
        if (extra > confidence) {
          confidence = extra;
          reasons.push("dom-signature");
        }
      }
      if (options.provider === "GENERIC") {
        return { provider: "GENERIC", confidence: 0.6, reasons: ["generic-fallback"], cautious: true, drifted: false };
      }
      return {
        provider: options.provider,
        confidence,
        reasons,
        cautious: confidence >= 0.7 && confidence < 0.9,
        drifted: false,
      };
    },
    async inspect(page) {
      const dedicated = options.provider !== "GENERIC" && options.provider !== "UNKNOWN";
      const primaryRoot = options.rootSelectors[0] ?? null;
      if (dedicated) {
        let rootFound = false;
        for (const root of options.rootSelectors) {
          const raw = await page.evaluateExpression<RawInspectResult>(
            `(${inspectDomSource})(${JSON.stringify(root)})`,
          );
          if (raw.providerRootFound) {
            rootFound = true;
            break;
          }
        }
        if (!rootFound) {
          throw Object.assign(new Error("ADAPTER_DRIFT"), { code: "ADAPTER_DRIFT" });
        }
      }
      for (const root of options.rootSelectors) {
        const snapshot = await inspectWithRoot(page, options.provider, root);
        if (snapshot.fields.length > 0) return snapshot;
      }
      return inspectWithRoot(page, options.provider, dedicated ? primaryRoot : "body");
    },
    async detectInterruptions(page) {
      const signals = await page.contentSignals();
      return detectInterruptionsFromDom(signals);
    },
    fillField: fillOnPage,
    async uploadAsset(page, selector, file: UploadedFileSpec) {
      await page.setInputFiles(selector, file);
    },
    async validateCurrentStep(page) {
      return page.evaluate(() => {
        const error = document.querySelector("[data-provider-error], [data-careeros-validation], .field-error, .error");
        const text = error?.textContent?.trim() ?? "";
        const fieldId = error?.getAttribute("data-field") ?? null;
        const recoverable = /phone|format|whitespace|date/i.test(text);
        if (!text) return { ok: true, fieldId: null, message: null, recoverableFormat: false };
        return { ok: false, fieldId, message: text, recoverableFormat: recoverable };
      });
    },
    async locateNextControl(page) {
      const snapshot = await inspectWithRoot(page, options.provider, options.rootSelectors[0] ?? "body");
      const next = pickTrustedAction(snapshot.actions, "NEXT_STEP") ?? pickTrustedAction(snapshot.actions, "SAVE_AND_CONTINUE");
      if (next) return { selector: next.selector, label: next.label, isFinal: false, confidence: next.confidence };
      return snapshot.nextControl;
    },
    async locateFinalSubmit(page) {
      const snapshot = await inspectWithRoot(page, options.provider, options.rootSelectors[0] ?? "body");
      const final = pickTrustedAction(snapshot.actions, "FINAL_SUBMIT");
      if (final) return { selector: final.selector, label: final.label, isFinal: true, confidence: final.confidence };
      if (snapshot.submitControl && snapshot.submitControl.confidence >= 0.85 && snapshot.submitControl.isFinal) return snapshot.submitControl;
      return null;
    },
    async advanceStep(page, selector) {
      await page.click(selector);
      await page.waitForTimeout(250);
    },
    async executeConfirmedSubmit(page, selector) {
      if (options.provider === "GENERIC" || options.provider === "UNKNOWN") {
        throw new Error("Generic adapter does not automatically submit.");
      }
      if (!isConfirmedSubmitEnabledForProvider(options.provider)) {
        throw new Error("Confirmed browser submit is disabled.");
      }
      await page.click(selector);
      await page.waitForTimeout(500);
    },
    async verifySubmission(page) {
      const signals = await page.contentSignals();
      const blob = `${signals.url} ${signals.title} ${signals.markers.join(" ")} ${signals.bodyTextSample}`.toLowerCase();
      const block = detectProviderPageBlock(blob);
      if (block === "JOB_CLOSED") {
        return {
          status: "FAILED",
          method: "provider_error",
          successMarkerCode: "JOB_CLOSED",
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: null,
          pageFingerprint: null,
          message: "Provider reports this job is closed.",
        };
      }
      if (block === "DUPLICATE_APPLICATION") {
        return {
          status: "FAILED",
          method: "provider_error",
          successMarkerCode: "DUPLICATE_APPLICATION",
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: null,
          pageFingerprint: null,
          message: "Provider reports an application already exists.",
        };
      }
      if (blob.includes(options.errorMarker.toLowerCase()) || /submission rejected/.test(blob)) {
        return {
          status: "FAILED",
          method: "provider_error",
          successMarkerCode: options.errorMarker,
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: null,
          pageFingerprint: null,
          message: "Provider reported a submission failure.",
        };
      }
      if (foreignSuccessMarkerPresent(options.provider, blob) && !blob.includes(options.successMarker.toLowerCase())) {
        return {
          status: "UNVERIFIED",
          method: "ambiguous",
          successMarkerCode: null,
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: null,
          pageFingerprint: hashish(signals.bodyTextSample),
          message: "Success marker belongs to a different provider.",
        };
      }
      const profile = verificationProfileFor(options.provider);
      const ownMarker = blob.includes(options.successMarker.toLowerCase());
      const successElement = profile
        ? profile.successSelectors.some((selector) => {
            const token = selector.match(/'([^']+)'/)?.[1];
            return token ? blob.includes(token.toLowerCase()) : false;
          })
        : false;
      const successUrl = profile ? profile.successUrlPatterns.some((pattern) => pattern.test(signals.url)) : false;
      const idMatch = blob.match(/application id[:\s]+([a-z0-9-]+)/i);
      const twoSignals = (ownMarker || successElement) && (successUrl || Boolean(idMatch));
      if (twoSignals) {
        return {
          status: "VERIFIED",
          method: "provider_marker",
          successMarkerCode: options.successMarker,
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: idMatch?.[1] ?? null,
          pageFingerprint: hashish(signals.bodyTextSample),
          message: `Verified by ${options.provider} adapter.`,
        };
      }
      if (ownMarker && !twoSignals) {
        return {
          status: "PROBABLE",
          method: "generic_thank_you",
          successMarkerCode: options.successMarker,
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: idMatch?.[1] ?? null,
          pageFingerprint: hashish(signals.bodyTextSample),
          message: "Provider marker present without a second trusted success signal.",
        };
      }
      if (/thank you|application received|successfully submitted/.test(blob)) {
        return {
          status: "PROBABLE",
          method: "generic_thank_you",
          successMarkerCode: null,
          confirmationUrl: safeUrl(page.url()),
          providerApplicationId: null,
          pageFingerprint: hashish(signals.bodyTextSample),
          message: "Generic thank-you page without a trusted provider marker.",
        };
      }
      return {
        status: "UNVERIFIED",
        method: "ambiguous",
        successMarkerCode: null,
        confirmationUrl: safeUrl(page.url()),
        providerApplicationId: null,
        pageFingerprint: hashish(signals.bodyTextSample),
        message: "Submission result could not be verified.",
      };
    },
  };
}

function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function hashish(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return String(hash);
}

export function genericAdapter(): ApplicationExecutionAdapter {
  return createBrowserAdapter({
    provider: "GENERIC",
    rootSelectors: ["[data-ats='generic']", "form", "body"],
    dataAts: "generic",
    successMarker: "careeros-generic-success",
    errorMarker: "careeros-generic-error",
    confirmedBrowserSubmit: false,
  });
}
