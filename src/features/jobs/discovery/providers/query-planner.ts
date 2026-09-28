import { MAX_COUNTRIES_PER_PROVIDER, MAX_QUERY_VARIANTS } from "../constants";
import { queryCountries, type SearchIntent } from "../quality/search-quality";
import type { DiscoveryProviderName } from "../types";

const EURES_COUNTRIES = new Set(["DE", "NL", "AT", "FR", "BE", "ES", "PL", "IT"]);

export function titleVariants(preferredTitles: string[]): string[] {
  const variants: string[] = [];
  const add = (title: string) => {
    const cleaned = title.trim().replace(/\s+/g, " ");
    if (cleaned.length < 8 || /^engineer$/i.test(cleaned)) return;
    if (variants.some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
    if (variants.length >= MAX_QUERY_VARIANTS) return;
    variants.push(cleaned);
  };

  for (const title of preferredTitles) add(title);
  for (const title of preferredTitles) {
    const key = title.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
    if (key === "backend engineer") add("Backend Developer");
    if (key === "backend developer") add("Backend Engineer");
    if (key === "full stack engineer" || key === "fullstack engineer") add("Full Stack Developer");
    if (key === "full stack developer" || key === "fullstack developer") add("Full Stack Engineer");
    if (key === "software engineer") add("Software Developer");
  }
  if (preferredTitles.some((title) => /backend|full[\s-]?stack|software/i.test(title))) {
    add("Software Engineer");
  }
  return variants;
}

export function plannedCountries(intent: SearchIntent): string[] {
  return queryCountries(intent).slice(0, MAX_COUNTRIES_PER_PROVIDER);
}

export function countriesForProvider(provider: DiscoveryProviderName, intent: SearchIntent): string[] {
  const countries = plannedCountries(intent);
  if (provider === "EURES") return countries.filter((country) => EURES_COUNTRIES.has(country));
  if (provider === "LEVER") return countries.filter((country) => country === "TR");
  if (provider === "GREENHOUSE") return countries.filter((country) => country === "TR" || country === "DE" || country === "NL");
  return countries;
}

export type ProviderPlan = {
  execute: boolean;
  reason: "ok" | "remote_not_requested" | "unsupported_target" | "not_runnable";
  keywords: string[];
  countries: string[];
};

export function planProviderSearch(provider: DiscoveryProviderName, intent: SearchIntent, remoteWanted: boolean): ProviderPlan {
  const keywords = titleVariants(intent.preferredTitles);
  if (provider === "LINKEDIN" || provider === "ASHBY") {
    return { execute: false, reason: "not_runnable", keywords, countries: [] };
  }
  if (provider === "REMOTIVE" && !remoteWanted) {
    return { execute: false, reason: "remote_not_requested", keywords, countries: [] };
  }
  if (provider === "REMOTIVE" || provider === "ARBEITNOW") {
    return { execute: true, reason: "ok", keywords, countries: [] };
  }
  const countries = countriesForProvider(provider, intent);
  if (countries.length === 0) {
    return { execute: false, reason: "unsupported_target", keywords, countries };
  }
  return { execute: true, reason: "ok", keywords, countries };
}
