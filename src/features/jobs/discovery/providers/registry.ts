import { PROVIDER_LABELS } from "../constants";
import type { DiscoveryProviderName, ProviderPreferences } from "../types";
import { DISCOVERY_PROVIDER_NAMES } from "../types";
import { PROVIDER_CAPABILITIES, type ProviderAvailability } from "./capabilities";
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
    if (!PROVIDER_CAPABILITIES[p.provider].runnable || !PROVIDER_CAPABILITIES[p.provider].adapterImplemented) return false;
    if (!p.isConfigured()) return false;
    if (preferences) {
      const pref = preferences[p.provider];
      if (pref === false) return false;
    }
    return true;
  });
}

export function getProviderStatus(): {
  provider: DiscoveryProviderName;
  status: ProviderAvailability;
  label: string;
}[] {
  const live = new Map(ALL_PROVIDERS.map((provider) => [provider.provider, provider]));
  return DISCOVERY_PROVIDER_NAMES.map((name) => {
    const adapter = live.get(name);
    if (adapter && PROVIDER_CAPABILITIES[name].adapterImplemented) {
      return {
        provider: name,
        status: adapter.getStatus(),
        label: PROVIDER_LABELS[name] ?? name,
      };
    }
    return {
      provider: name,
      status: PROVIDER_CAPABILITIES[name].availability,
      label: PROVIDER_LABELS[name] ?? name,
    };
  });
}
