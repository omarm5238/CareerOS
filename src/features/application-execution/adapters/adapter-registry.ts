import type { ApplicationProvider } from "@/generated/prisma/client";

import type { ApplicationBrowserPage, ApplicationExecutionAdapter } from "../browser/application-browser-runner";
import type { DetectionResult } from "../types";
import { genericAdapter, hostnameProvider } from "./application-execution-adapter";
import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { workableAdapter } from "./workable";
import { smartrecruitersAdapter } from "./smartrecruiters";

const DEDICATED: ApplicationExecutionAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workableAdapter,
  smartrecruitersAdapter,
];

export function officialApiAvailable(): boolean {
  return false;
}

export async function detectProvider(page: ApplicationBrowserPage): Promise<DetectionResult> {
  const url = page.url();
  const results = await Promise.all(DEDICATED.map(async (adapter) => ({ adapter, detection: await adapter.detect(page) })));
  const ranked = results.sort((a, b) => b.detection.confidence - a.detection.confidence);
  const top = ranked[0];
  const second = ranked[1];
  const host = hostnameProvider(url);
  if (top && second && top.detection.confidence >= 0.7 && Math.abs(top.detection.confidence - second.detection.confidence) < 0.05) {
    return { provider: "GENERIC", confidence: 0.4, reasons: ["conflicting-signals"], cautious: true, drifted: false };
  }
  if (top && top.detection.confidence >= 0.9) return top.detection;
  if (top && top.detection.confidence >= 0.7) return { ...top.detection, cautious: true };
  if (host) return { provider: host.provider, confidence: host.confidence, reasons: ["hostname-only"], cautious: true, drifted: false };
  return { provider: "GENERIC", confidence: 0.55, reasons: ["below-threshold"], cautious: true, drifted: false };
}

export function selectAdapter(provider: ApplicationProvider, drifted: boolean): ApplicationExecutionAdapter {
  if (drifted || provider === "GENERIC" || provider === "UNKNOWN") return genericAdapter();
  return DEDICATED.find((adapter) => adapter.provider === provider) ?? genericAdapter();
}

export function adapterSupportsConfirmedSubmit(provider: ApplicationProvider, drifted: boolean): boolean {
  if (drifted) return false;
  return selectAdapter(provider, false).capabilities().confirmedBrowserSubmit;
}

export { genericAdapter };
