import type { DiscoveryProviderName } from "../types";

export type ProviderAvailability =
  | "available"
  | "not_configured"
  | "unavailable"
  | "unsupported"
  | "partner_access_required";

export type ProviderCapability = {
  provider: DiscoveryProviderName;
  label: string;
  availability: ProviderAvailability;
  runnable: boolean;
  sourceKind: "AGGREGATOR" | "OFFICIAL_ATS" | "PUBLIC_REGIONAL" | "OFFICIAL_PARTNER";
  adapterImplemented: boolean;
};

/**
 * Identity and availability only.
 * New providers have no search adapter and must not be queried.
 */
export const PROVIDER_CAPABILITIES: Record<DiscoveryProviderName, ProviderCapability> = {
  REMOTIVE: {
    provider: "REMOTIVE",
    label: "Remotive",
    availability: "available",
    runnable: true,
    sourceKind: "AGGREGATOR",
    adapterImplemented: true,
  },
  ARBEITNOW: {
    provider: "ARBEITNOW",
    label: "Arbeitnow",
    availability: "available",
    runnable: true,
    sourceKind: "AGGREGATOR",
    adapterImplemented: true,
  },
  ADZUNA: {
    provider: "ADZUNA",
    label: "Adzuna",
    availability: "not_configured",
    runnable: true,
    sourceKind: "AGGREGATOR",
    adapterImplemented: true,
  },
  JOOBLE: {
    provider: "JOOBLE",
    label: "Jooble",
    availability: "not_configured",
    runnable: true,
    sourceKind: "AGGREGATOR",
    adapterImplemented: true,
  },
  GREENHOUSE: {
    provider: "GREENHOUSE",
    label: "Greenhouse",
    availability: "unsupported",
    runnable: false,
    sourceKind: "OFFICIAL_ATS",
    adapterImplemented: false,
  },
  LEVER: {
    provider: "LEVER",
    label: "Lever",
    availability: "unsupported",
    runnable: false,
    sourceKind: "OFFICIAL_ATS",
    adapterImplemented: false,
  },
  ASHBY: {
    provider: "ASHBY",
    label: "Ashby",
    availability: "unsupported",
    runnable: false,
    sourceKind: "OFFICIAL_ATS",
    adapterImplemented: false,
  },
  EURES: {
    provider: "EURES",
    label: "EURES",
    availability: "unsupported",
    runnable: false,
    sourceKind: "PUBLIC_REGIONAL",
    adapterImplemented: false,
  },
  LINKEDIN: {
    provider: "LINKEDIN",
    label: "LinkedIn",
    availability: "partner_access_required",
    runnable: false,
    sourceKind: "OFFICIAL_PARTNER",
    adapterImplemented: false,
  },
};
