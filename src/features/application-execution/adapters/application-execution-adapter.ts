import type { ApplicationProvider } from "@/generated/prisma/client";

import { classifyApplicationField, detectDocumentKind, normalizeLabel } from "../classification/classify-application-field";
import { detectInterruptionsFromDom } from "../classification/detect-interruptions";
import type { ApplicationBrowserPage, ApplicationExecutionAdapter, UploadedFileSpec } from "../browser/application-browser-runner";
import { ADAPTER_VERSION } from "../types";
import type {
  AdapterCapabilities,
  ApplicationFormSnapshot,
} from "../types";
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
        currentValueState: "unknown" as const,
        currentValuePreview: null,
        documentKind: detectDocumentKind(field.label),
      };
    });

  return {
    provider,
    pageUrl: page.url(),
    step: raw.step,
    totalSteps: raw.totalSteps,
    fields,
    submitControl: raw.submitSelector
      ? { selector: { strategy: "css", value: raw.submitSelector }, label: raw.submitLabel ?? "Submit", isFinal: true, confidence: 0.9 }
      : null,
    nextControl: raw.nextSelector
      ? { selector: { strategy: "css", value: raw.nextSelector }, label: raw.nextLabel ?? "Next", isFinal: false, confidence: 0.9 }
      : null,
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
  extraDetect?: (url: string, htmlMarkers: string[]) => number;
}): ApplicationExecutionAdapter {
  const capabilities = (): AdapterCapabilities => ({
    inspectForm: true,
    fillFields: true,
    uploadFiles: true,
    multiStep: true,
    detectLogin: true,
    detectCaptcha: true,
    detectAssessment: true,
    confirmedBrowserSubmit: options.confirmedBrowserSubmit,
    verificationStrength: options.provider === "GENERIC" || options.provider === "UNKNOWN" ? "generic" : "provider",
    officialApiSubmit: false,
  });

  return {
    provider: options.provider,
    version: ADAPTER_VERSION,
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
      return snapshot.nextControl;
    },
    async locateFinalSubmit(page) {
      const snapshot = await inspectWithRoot(page, options.provider, options.rootSelectors[0] ?? "body");
      return snapshot.submitControl;
    },
    async advanceStep(page, selector) {
      await page.click(selector);
      await page.waitForTimeout(250);
    },
    async executeConfirmedSubmit(page, selector) {
      if (!options.confirmedBrowserSubmit) {
        throw new Error("Generic adapter does not automatically submit.");
      }
      await page.click(selector);
      await page.waitForTimeout(500);
    },
    async verifySubmission(page) {
      const signals = await page.contentSignals();
      const blob = `${signals.url} ${signals.title} ${signals.markers.join(" ")} ${signals.bodyTextSample}`.toLowerCase();
      if (blob.includes(options.errorMarker.toLowerCase()) || /submission rejected|job closed|duplicate application/.test(blob)) {
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
      if (blob.includes(options.successMarker.toLowerCase())) {
        const idMatch = blob.match(/application id[:\s]+([a-z0-9-]+)/i);
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
