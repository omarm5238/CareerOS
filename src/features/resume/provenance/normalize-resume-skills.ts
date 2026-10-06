const CATEGORY_PREFIX = /^(?:languages|frameworks(?:\s*\/\s*[\w+-]+)?|databases(?:\s*\/\s*[\w+-]+)?|ai(?:\s*\/\s*[\w+-]+)+|tools|skills|technologies|technical skills)\s*:\s*(.+)$/i;

export function canonicalResumeSkillName(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const prefixed = trimmed.match(CATEGORY_PREFIX);
  if (!prefixed) return trimmed;
  const skill = prefixed[1].trim();
  if (!skill || skill.includes(":") || skill.length > 40) return trimmed;
  return skill;
}

export function canonicalResumeSkills(values: string[]): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const value of values) {
    const skill = canonicalResumeSkillName(value);
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
  }
  return skills;
}
