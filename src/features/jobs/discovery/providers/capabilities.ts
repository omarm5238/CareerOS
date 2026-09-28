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
    availability: "available",
    runnable: true,
    sourceKind: "OFFICIAL_ATS",
    adapterImplemented: true,
  },
  LEVER: {
    provider: "LEVER",
    label: "Lever",
    availability: "available",
    runnable: true,
    sourceKind: "OFFICIAL_ATS",
    adapterImplemented: true,
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
    availability: "available",
    runnable: true,
    sourceKind: "PUBLIC_REGIONAL",
    adapterImplemented: true,
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

export type ProviderFeatures = {
  supportsCountryQuery: boolean;
  supportsMultiCountry: boolean;
  supportsKeywordQuery: boolean;
  supportsRemoteFilter: boolean;
  supportsDateFilter: boolean;
  supportsPagination: boolean;
  providesPostedDate: boolean;
  providesCanonicalApplyUrl: boolean;
  requiresApiKey: boolean;
  supportedCountries: string[];
  maxPages: number;
  maxResults: number;
};

export const PROVIDER_FEATURES: Record<DiscoveryProviderName, ProviderFeatures> = {
  REMOTIVE: { supportsCountryQuery: false, supportsMultiCountry: false, supportsKeywordQuery: true, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: false, supportedCountries: [], maxPages: 1, maxResults: 50 },
  ARBEITNOW: { supportsCountryQuery: false, supportsMultiCountry: false, supportsKeywordQuery: false, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: true, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: false, supportedCountries: [], maxPages: 3, maxResults: 50 },
  ADZUNA: { supportsCountryQuery: true, supportsMultiCountry: false, supportsKeywordQuery: true, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: true, supportedCountries: ["DE", "NL", "GB", "FR", "AT", "PL", "ES", "IT"], maxPages: 1, maxResults: 25 },
  JOOBLE: { supportsCountryQuery: true, supportsMultiCountry: false, supportsKeywordQuery: true, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: true, supportedCountries: ["US", "GB", "DE", "TR"], maxPages: 1, maxResults: 50 },
  LEVER: { supportsCountryQuery: false, supportsMultiCountry: false, supportsKeywordQuery: false, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: false, supportedCountries: ["TR"], maxPages: 1, maxResults: 50 },
  GREENHOUSE: { supportsCountryQuery: false, supportsMultiCountry: true, supportsKeywordQuery: false, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: false, supportedCountries: ["TR", "DE", "NL"], maxPages: 1, maxResults: 50 },
  ASHBY: { supportsCountryQuery: false, supportsMultiCountry: false, supportsKeywordQuery: false, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: false, providesCanonicalApplyUrl: false, requiresApiKey: false, supportedCountries: [], maxPages: 0, maxResults: 0 },
  EURES: { supportsCountryQuery: true, supportsMultiCountry: true, supportsKeywordQuery: true, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: true, providesPostedDate: true, providesCanonicalApplyUrl: true, requiresApiKey: false, supportedCountries: ["DE", "NL", "AT", "FR", "BE", "ES", "PL", "IT"], maxPages: 1, maxResults: 50 },
  LINKEDIN: { supportsCountryQuery: false, supportsMultiCountry: false, supportsKeywordQuery: false, supportsRemoteFilter: false, supportsDateFilter: false, supportsPagination: false, providesPostedDate: false, providesCanonicalApplyUrl: false, requiresApiKey: false, supportedCountries: [], maxPages: 0, maxResults: 0 },
};
