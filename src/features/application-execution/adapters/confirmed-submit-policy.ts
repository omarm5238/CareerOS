import type { ApplicationProvider } from "@/generated/prisma/client";

import { getProviderCapability } from "./provider-submission-capabilities";
import { isGlobalConfirmedSubmitEnabled, isProviderSubmitSwitchEnabled } from "../lib/env-flags";

export function isConfirmedSubmitEnabledForProvider(provider: ApplicationProvider): boolean {
  if (provider === "GENERIC" || provider === "UNKNOWN") return false;
  if (!isGlobalConfirmedSubmitEnabled()) return false;
  if (!isProviderSubmitSwitchEnabled(provider)) return false;
  return getProviderCapability(provider).confirmedBrowserSubmitEligible;
}
