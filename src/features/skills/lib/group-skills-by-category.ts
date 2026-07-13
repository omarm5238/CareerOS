import { SKILL_CATEGORY_MAP, SKILL_CATEGORY_ORDER } from "../constants";
import type { GroupedSkills, SkillCategory } from "../types";

function normalizeSkill(skill: string): string {
  return skill.trim();
}

function findCategoryForSkill(skill: string): SkillCategory {
  const lower = skill.toLowerCase();

  for (const category of SKILL_CATEGORY_ORDER) {
    if (category === "Other") continue;

    const catalog = SKILL_CATEGORY_MAP[category];
    const match = catalog.some((entry) => entry.toLowerCase() === lower);
    if (match) return category;
  }

  return "Other";
}

function dedupePreserveCase(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const skill of skills) {
    const trimmed = normalizeSkill(skill);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function groupSkillsByCategory(skills: string[]): GroupedSkills {
  const grouped: GroupedSkills = {
    Technical: [],
    Design: [],
    Tools: [],
    "Soft Skills": [],
    Data: [],
    Other: [],
  };

  for (const skill of dedupePreserveCase(skills)) {
    grouped[findCategoryForSkill(skill)].push(skill);
  }

  return grouped;
}

export function countNonEmptyCategories(grouped: GroupedSkills): number {
  return SKILL_CATEGORY_ORDER.filter((category) => grouped[category].length > 0).length;
}
