import type { JobRequirementCategory, JobRequirementImportance } from "@/generated/prisma/client";

import { JOB_SKILL_CATALOG } from "@/features/jobs/constants";
import { normalizeToken } from "../lib/hash";
import type { JobRequirementInput } from "../types";

const EXTRA_SKILLS = [
  "Go",
  "Golang",
  "Firebase",
  "AWS",
  "GCP",
  "Azure",
  "Kubernetes",
  "Prisma",
  "GraphQL",
  "Redis",
  "Linux",
  "CI/CD",
  "REST APIs",
  "TypeScript",
  "Node.js",
  "PostgreSQL",
  "Docker",
];

const SKILL_ALIASES: Record<string, string[]> = {
  "rest apis": ["rest api", "restful", "rest apis"],
  "rest api": ["rest api", "restful", "rest apis"],
  docker: ["docker"],
  go: ["golang", " go "],
  postgresql: ["postgres", "postgresql"],
};

function excerptAround(text: string, needle: string): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(needle.toLowerCase());
  if (index < 0) return text.slice(0, 180);
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + needle.length + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function importanceFromContext(context: string): JobRequirementImportance {
  const lower = context.toLowerCase();
  if (/\b(must|required|mandatory|need to have)\b/.test(lower)) return "REQUIRED";
  if (/\b(strongly preferred|highly preferred)\b/.test(lower)) return "STRONGLY_PREFERRED";
  if (/\b(preferred|nice to have|plus|bonus)\b/.test(lower)) return "PREFERRED";
  if (/\b(optional)\b/.test(lower)) return "OPTIONAL";
  return "UNKNOWN";
}

function pushUnique(list: JobRequirementInput[], item: JobRequirementInput) {
  const key = `${item.category}:${normalizeToken(item.normalizedName)}`;
  if (list.some((existing) => `${existing.category}:${normalizeToken(existing.normalizedName)}` === key)) {
    return;
  }
  list.push(item);
}

export function extractJobRequirementsDeterministic(input: {
  title: string;
  description: string;
}): JobRequirementInput[] {
  const text = `${input.title}\n${input.description}`;
  const lower = ` ${text.toLowerCase()} `;
  const results: JobRequirementInput[] = [];

  const catalog = [...JOB_SKILL_CATALOG, ...EXTRA_SKILLS];
  for (const skill of catalog) {
    const aliases = SKILL_ALIASES[normalizeToken(skill)] ?? [skill];
    const hit = aliases.find((alias) => lower.includes(alias.toLowerCase()));
    if (!hit) continue;
    const excerpt = excerptAround(text, hit);
    pushUnique(results, {
      category: "SKILL",
      importance: importanceFromContext(excerpt),
      normalizedName: skill,
      rawText: hit,
      sourceExcerpt: excerpt,
      yearsRequired: null,
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  const yearMatch = text.match(/(\d+)\s*[-–to]{1,3}\s*(\d+)?\s*\+?\s*years?/i);
  if (yearMatch) {
    const excerpt = excerptAround(text, yearMatch[0]);
    pushUnique(results, {
      category: "EXPERIENCE",
      importance: importanceFromContext(excerpt) === "UNKNOWN" ? "REQUIRED" : importanceFromContext(excerpt),
      normalizedName: `${yearMatch[1]}+ years experience`,
      rawText: yearMatch[0],
      sourceExcerpt: excerpt,
      yearsRequired: Number(yearMatch[1]),
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  if (/\b(work authorization|authorized to work|right to work)\b/i.test(text)) {
    const excerpt = excerptAround(text, "authoriz");
    pushUnique(results, {
      category: "AUTHORIZATION",
      importance: "REQUIRED",
      normalizedName: "Work authorization",
      rawText: "work authorization",
      sourceExcerpt: excerpt,
      yearsRequired: null,
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  if (/\b(visa|sponsorship|sponsor)\b/i.test(text)) {
    const excerpt = excerptAround(text, "sponsor");
    pushUnique(results, {
      category: "AUTHORIZATION",
      importance: "UNKNOWN",
      normalizedName: "Visa sponsorship",
      rawText: "visa sponsorship",
      sourceExcerpt: excerpt,
      yearsRequired: null,
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  if (/\b(security clearance|clearance)\b/i.test(text)) {
    const excerpt = excerptAround(text, "clearance");
    pushUnique(results, {
      category: "SECURITY_CLEARANCE",
      importance: "REQUIRED",
      normalizedName: "Security clearance",
      rawText: "security clearance",
      sourceExcerpt: excerpt,
      yearsRequired: null,
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  if (/\bcover letter\b/i.test(text)) {
    const excerpt = excerptAround(text, "cover letter");
    pushUnique(results, {
      category: "OTHER",
      importance: "REQUIRED",
      normalizedName: "Cover letter",
      rawText: "cover letter",
      sourceExcerpt: excerpt,
      yearsRequired: null,
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  if (/\b(portfolio|github)\b/i.test(text)) {
    const excerpt = excerptAround(text, "portfolio");
    pushUnique(results, {
      category: "OTHER",
      importance: importanceFromContext(excerpt),
      normalizedName: "Portfolio",
      rawText: "portfolio",
      sourceExcerpt: excerpt,
      yearsRequired: null,
      proficiencyRequired: null,
      isExplicit: true,
    });
  }

  return results;
}

export function sanitizeExtractedRequirements(raw: unknown): JobRequirementInput[] {
  if (!Array.isArray(raw)) return [];
  const categories: JobRequirementCategory[] = [
    "SKILL",
    "EXPERIENCE",
    "EDUCATION",
    "LANGUAGE",
    "CERTIFICATION",
    "LOCATION",
    "AUTHORIZATION",
    "SECURITY_CLEARANCE",
    "EMPLOYMENT",
    "OTHER",
  ];
  const importances: JobRequirementImportance[] = [
    "REQUIRED",
    "STRONGLY_PREFERRED",
    "PREFERRED",
    "OPTIONAL",
    "UNKNOWN",
  ];

  const items: JobRequirementInput[] = [];
  for (const value of raw.slice(0, 24)) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const category = categories.includes(record.category as JobRequirementCategory)
      ? (record.category as JobRequirementCategory)
      : "OTHER";
    const importance = importances.includes(record.importance as JobRequirementImportance)
      ? (record.importance as JobRequirementImportance)
      : "UNKNOWN";
    const normalizedName = typeof record.normalizedName === "string" ? record.normalizedName.trim() : "";
    const rawText = typeof record.rawText === "string" ? record.rawText.trim() : normalizedName;
    const sourceExcerpt = typeof record.sourceExcerpt === "string" ? record.sourceExcerpt.trim() : rawText;
    if (!normalizedName || !sourceExcerpt) continue;
    items.push({
      category,
      importance,
      normalizedName: normalizedName.slice(0, 80),
      rawText: rawText.slice(0, 160),
      sourceExcerpt: sourceExcerpt.slice(0, 280),
      yearsRequired: typeof record.yearsRequired === "number" ? record.yearsRequired : null,
      proficiencyRequired:
        typeof record.proficiencyRequired === "string" ? record.proficiencyRequired.slice(0, 40) : null,
      isExplicit: record.isExplicit !== false,
    });
  }
  return items;
}
