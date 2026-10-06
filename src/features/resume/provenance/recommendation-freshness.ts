import type { EvidenceCatalog } from "./evidence-catalog";

export function isObsoleteRecommendation(text: string, catalog: EvidenceCatalog): boolean {
  const lower = text.toLowerCase();
  if (
    catalog.hasSkillsSection
    && /\bskills?\s+section\b/.test(lower)
    && /\b(no|not|missing|unclear|lack|without|add|include|create|expand|clarify)\b/.test(lower)
  ) {
    return true;
  }
  const hasProvenLink = catalog.links.some((link) => link.kind === "github" || link.kind === "portfolio" || link.kind === "project");
  if (
    hasProvenLink
    && /\b(add|include|missing|no)\b/.test(lower)
    && /\b(portfolio|github|project link|deployed projects)\b/.test(lower)
  ) {
    return true;
  }
  const asksToAdd = /\b(add|include|create|highlight|missing|expand|clarify)\b/.test(lower);
  if (!asksToAdd) return false;
  if (catalog.hasSkillsSection && /\badd\b.*\bskills?\b|\bexpand\b.*\bskills?\b|\bclarify core skills\b/.test(lower)) {
    return true;
  }
  return false;
}

export function currentRecommendationTexts(items: string[], catalog: EvidenceCatalog): string[] {
  return items.filter((item) => !isObsoleteRecommendation(item, catalog));
}

export function keepCurrentImprovementItems<T extends { title: string; reason: string }>(
  items: T[],
  catalog: EvidenceCatalog | null,
): T[] {
  if (!catalog) return items;
  return items.filter((item) => !isObsoleteRecommendation(`${item.title} ${item.reason}`, catalog));
}
