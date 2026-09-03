import type { DiscoveryProviderName, ProviderPreferences } from "../types";
import type { JobDiscoveryProvider } from "./types";
import { RemotiveProvider } from "./remotive";
import { ArbeitnowProvider } from "./arbeitnow";
import { AdzunaProvider } from "./adzuna";
import { JoobleProvider } from "./jooble";

const ALL_PROVIDERS: JobDiscoveryProvider[] = [
  new RemotiveProvider(),
  new ArbeitnowProvider(),
  new AdzunaProvider(),
  new JoobleProvider(),
];

export function getAllProviders(): JobDiscoveryProvider[] {
  return ALL_PROVIDERS;
}

export function getEnabledProviders(preferences?: ProviderPreferences): JobDiscoveryProvider[] {
  return ALL_PROVIDERS.filter(p => {
    if (!p.isConfigured()) return false;
    if (preferences) {
      const pref = preferences[p.provider as keyof ProviderPreferences];
      if (pref === false) return false;
    }
    return true;
  });
}

export function getProviderStatus(): { provider: DiscoveryProviderName; status: string; label: string }[] {
  return ALL_PROVIDERS.map(p => ({
    provider: p.provider,
    status: p.getStatus(),
    label: p.provider === "REMOTIVE" ? "Remotive"
      : p.provider === "ARBEITNOW" ? "Arbeitnow"
      : p.provider === "ADZUNA" ? "Adzuna"
      : "Jooble",
  }));
}
