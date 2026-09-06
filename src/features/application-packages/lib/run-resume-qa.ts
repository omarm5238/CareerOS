import { parseResumeVersionContent } from "@/features/resume/versions/lib/json-parsers";

export function runResumeQa(input: {
  jobTitle: string;
  company: string;
  content: unknown;
}): { passed: boolean; issues: string[] } {
  const content = parseResumeVersionContent(input.content);
  const blob = [
    content.summary,
    ...content.coreSkills,
    ...content.experienceBullets.map((item) => item.tailored),
    ...content.projects.map((item) => item.tailored),
  ]
    .join(" ")
    .toLowerCase();

  const issues: string[] = [];
  if (!content.summary && content.coreSkills.length === 0) {
    issues.push("Resume content is empty or unstructured.");
  }
  if (/\b(i have \d+ years|ten years|15 years)\b/.test(blob) && !blob.includes("year")) {
    issues.push("Possible unsupported experience duration.");
  }
  const otherCompany = blob.includes(" merantix ") && !input.company.toLowerCase().includes("merantix");
  if (otherCompany) {
    issues.push("Resume may mention a different company than this job.");
  }

  return { passed: issues.length === 0, issues };
}
