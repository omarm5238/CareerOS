export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "INTERNSHIP"
  | "CONTRACT"
  | "FREELANCE"
  | "UNKNOWN";

export type ResumeLinkKind = "github" | "portfolio" | "project" | "other";

export type EvidenceCatalog = {
  version: 1;
  hasSkillsSection: boolean;
  skills: Array<{ label: string; excerpt: string }>;
  links: Array<{ kind: ResumeLinkKind; url: string; excerpt: string }>;
  experiences: Array<{
    label: string;
    excerpt: string;
    commercial: boolean;
    employmentType: EmploymentType;
    durationMonths: number | null;
    technologies: string[];
  }>;
  projects: Array<{
    label: string;
    excerpt: string;
    technologies: string[];
    commercial: false;
  }>;
  education: Array<{ label: string; excerpt: string }>;
};

const SKILL_LEXICON = [
  "TypeScript",
  "JavaScript",
  "C#",
  "C++",
  "Java",
  ".NET",
  "Node.js",
  "PostgreSQL",
  "React",
  "Python",
  "Go",
  "Docker",
  "Prisma",
  "Express",
  "Git",
];

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function excerpt(text: string, limit = 180): string {
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function technologiesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_LEXICON.filter((skill) => {
    const token = skill.toLowerCase();
    if (token === "c#") return /c#/.test(lower);
    if (token === "c++") return /c\+\+/.test(lower);
    if (token === ".net") return /\.net\b|dotnet\b/.test(lower);
    if (token === "java") return /\bjava\b/.test(lower) && !/\bjavascript\b/.test(lower);
    if (token === "go") return /\bgolang\b|\bgo\b/.test(lower);
    return new RegExp(`\\b${token.replace(".", "\\.")}\\b`, "i").test(text);
  });
}

function employmentType(text: string): EmploymentType {
  const lower = text.toLowerCase();
  if (/\bintern(ship)?\b/.test(lower)) return "INTERNSHIP";
  if (/\bfreelance\b/.test(lower)) return "FREELANCE";
  if (/\bcontract\b/.test(lower)) return "CONTRACT";
  if (/\bpart[- ]time\b/.test(lower)) return "PART_TIME";
  if (/\bfull[- ]time\b/.test(lower)) return "FULL_TIME";
  return "UNKNOWN";
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

function mergeMonths(ranges: Array<[number, number]>): number {
  const ordered = ranges.filter(([start, end]) => end >= start).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -1;
  for (const [start, end] of ordered) {
    const from = Math.max(start, cursor + 1);
    if (end >= from) total += end - from + 1;
    cursor = Math.max(cursor, end);
  }
  return total;
}

function durationMonths(text: string, now = new Date()): number | null {
  const ranges: Array<[number, number]> = [];
  const monthName = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const dated = new RegExp(`\\b(${monthName})\\s+(\\d{4})\\s*(?:-|–|to)\\s*(?:(${monthName})\\s+(\\d{4})|(present|current))`, "gi");
  for (const match of text.matchAll(dated)) {
    const startMonth = MONTH_INDEX[match[1].toLowerCase()];
    const startYear = Number(match[2]);
    const present = Boolean(match[5]);
    const endMonth = present ? now.getMonth() : MONTH_INDEX[(match[3] ?? "").toLowerCase()];
    const endYear = present ? now.getFullYear() : Number(match[4]);
    if (startMonth === undefined || endMonth === undefined || !startYear || !endYear) continue;
    ranges.push([monthIndex(startYear, startMonth), monthIndex(endYear, endMonth)]);
  }
  if (ranges.length === 0) {
    const yearsOnly = text.matchAll(/(\d{4})\s*(?:-|–)\s*(\d{4}|present|current)/gi);
    for (const match of yearsOnly) {
      const startYear = Number(match[1]);
      const present = /present|current/i.test(match[2]);
      const endYear = present ? now.getFullYear() : Number(match[2]);
      if (!startYear || !endYear) continue;
      ranges.push([monthIndex(startYear, 0), monthIndex(endYear, present ? now.getMonth() : 11)]);
    }
  }
  if (ranges.length > 0) return mergeMonths(ranges);
  const explicit = text.match(/(\d+)\s*\+?\s*(years?|months?)/i);
  if (!explicit) return null;
  const amount = Number(explicit[1]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 80) return null;
  return /month/i.test(explicit[2]) ? amount : amount * 12;
}

function sectionKind(line: string): "skills" | "experience" | "projects" | "education" | null {
  const heading = line.trim().toLowerCase().replace(/:$/, "");
  if (/^(technical skills|core skills|skills)$/.test(heading)) return "skills";
  if (/^(work experience|professional experience|experience|employment|work history)$/.test(heading)) return "experience";
  if (/^(projects|personal projects|academic projects|portfolio projects)$/.test(heading)) return "projects";
  if (/^(education)$/.test(heading)) return "education";
  return null;
}

function skillLabels(section: string): string[] {
  const pieces = section
    .split(/[\n,;|•·]/)
    .map((part) => part.replace(/^[-*]\s*/, "").trim())
    .filter((part) => part.length > 1 && part.length <= 40 && !sectionKind(part));
  return uniqueLabels([...pieces, ...technologiesIn(section)]);
}

function blocks(section: string): string[] {
  return section
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !sectionKind(block.split("\n")[0] ?? ""));
}

export function extractEvidenceCatalog(text: string, now = new Date()): EvidenceCatalog {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const buckets: Record<"skills" | "experience" | "projects" | "education" | "other", string[]> = {
    skills: [],
    experience: [],
    projects: [],
    education: [],
    other: [],
  };
  let current: keyof typeof buckets = "other";
  for (const line of lines) {
    const kind = sectionKind(line);
    if (kind) {
      current = kind;
      continue;
    }
    buckets[current].push(line);
  }

  const skillsText = buckets.skills.join("\n");
  const skills = skillLabels(skillsText).map((label) => ({ label, excerpt: excerpt(skillsText || label) }));
  const experiences = blocks(buckets.experience.join("\n")).map((block) => {
    const personal = /\b(personal project|academic|coursework|university project)\b/i.test(block);
    return {
      label: excerpt(block.split("\n")[0] ?? "Experience", 80),
      excerpt: excerpt(block),
      commercial: !personal,
      employmentType: employmentType(block),
      durationMonths: durationMonths(block, now),
      technologies: technologiesIn(block),
    };
  });
  const projects = blocks(buckets.projects.join("\n")).map((block) => ({
    label: excerpt(block.split("\n")[0] ?? "Project", 80),
    excerpt: excerpt(block),
    technologies: technologiesIn(block),
    commercial: false as const,
  }));
  const education = blocks(buckets.education.join("\n")).map((block) => ({
    label: excerpt(block.split("\n")[0] ?? "Education", 80),
    excerpt: excerpt(block),
  }));

  const links: EvidenceCatalog["links"] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s)]+/gi)) {
    const url = match[0].replace(/[.,]$/, "");
    const around = text.slice(Math.max(0, (match.index ?? 0) - 40), (match.index ?? 0) + url.length + 40);
    const kind: ResumeLinkKind = /github\.com/i.test(url)
      ? "github"
      : /project/i.test(around)
        ? "project"
        : "portfolio";
    links.push({ kind, url, excerpt: excerpt(around) });
  }
  for (const match of text.matchAll(/\bgithub\.com\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/gi)) {
    const url = match[0];
    if (links.some((link) => link.url.toLowerCase().includes(url.toLowerCase()))) continue;
    links.push({ kind: "github", url, excerpt: excerpt(text.slice(Math.max(0, (match.index ?? 0) - 30), (match.index ?? 0) + url.length + 30)) });
  }

  return {
    version: 1,
    hasSkillsSection: buckets.skills.some((line) => line.trim().length > 0),
    skills,
    links,
    experiences,
    projects,
    education,
  };
}

export function packAnalysisNotes(messages: string[], catalog: EvidenceCatalog) {
  return { messages, evidenceCatalog: catalog };
}

export function readAnalysisNotes(value: unknown): { messages: string[]; catalog: EvidenceCatalog | null } {
  if (Array.isArray(value)) {
    return { messages: value.filter((item): item is string => typeof item === "string"), catalog: null };
  }
  if (!value || typeof value !== "object") return { messages: [], catalog: null };
  const record = value as { messages?: unknown; evidenceCatalog?: unknown };
  const messages = Array.isArray(record.messages)
    ? record.messages.filter((item): item is string => typeof item === "string")
    : [];
  const catalog = parseCatalog(record.evidenceCatalog);
  return { messages, catalog };
}

function parseCatalog(value: unknown): EvidenceCatalog | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<EvidenceCatalog>;
  if (record.version !== 1 || !Array.isArray(record.skills)) return null;
  return {
    version: 1,
    hasSkillsSection: record.hasSkillsSection === true,
    skills: record.skills.filter((item) => item && typeof item.label === "string") as EvidenceCatalog["skills"],
    links: Array.isArray(record.links) ? record.links as EvidenceCatalog["links"] : [],
    experiences: Array.isArray(record.experiences) ? record.experiences as EvidenceCatalog["experiences"] : [],
    projects: Array.isArray(record.projects) ? record.projects as EvidenceCatalog["projects"] : [],
    education: Array.isArray(record.education) ? record.education as EvidenceCatalog["education"] : [],
  };
}
