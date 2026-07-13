import { analyzeResumeWithFallback } from "../ai/fallback-resume-analyzer";
import { detectResumeDomain, type ResumeDomain } from "./detect-resume-domain";

export type DomainDetectionSample = {
  name: string;
  text: string;
  expectedDomain: ResumeDomain;
  expectedRoles: string[];
  expectedSkills: string[];
  forbiddenRoles?: string[];
  focusKeywords?: string[];
};

export const DOMAIN_DETECTION_SAMPLES: DomainDetectionSample[] = [
  {
    name: "design",
    text: "Graphic Designer with experience in branding, logo design, Photoshop, Illustrator, social media design, typography, and Behance portfolio.",
    expectedDomain: "design",
    expectedRoles: ["Graphic Designer", "Visual Designer", "Brand Designer"],
    expectedSkills: ["Photoshop", "Illustrator", "Branding", "Typography"],
    forbiddenRoles: ["Software Engineer"],
    focusKeywords: ["Portfolio", "Brand", "Design"],
  },
  {
    name: "software",
    text: "Full Stack Developer with React, Next.js, Node.js, PostgreSQL, REST APIs, and Docker.",
    expectedDomain: "software",
    expectedRoles: ["Full Stack Engineer"],
    expectedSkills: ["React", "Next.js", "Node.js", "PostgreSQL", "Docker"],
    focusKeywords: ["Testing", "Cloud", "System Design", "Database"],
  },
  {
    name: "unknown",
    text: "Professional with experience in operations and customer support.",
    expectedDomain: "unknown",
    expectedRoles: ["General Professional", "Business Professional"],
    expectedSkills: [],
    forbiddenRoles: ["Software Engineer"],
    focusKeywords: ["Professional Summary", "Achievement", "Skills"],
  },
];

export function runDomainDetectionSanityChecks(): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const sample of DOMAIN_DETECTION_SAMPLES) {
    const { domain } = detectResumeDomain(sample.text);
    if (domain !== sample.expectedDomain) {
      failures.push(
        `[${sample.name}] expected domain "${sample.expectedDomain}", got "${domain}"`,
      );
    }

    const result = analyzeResumeWithFallback(sample.text, {
      filename: `${sample.name}.pdf`,
      fileSize: 1024,
    });

    if (!sample.expectedRoles.includes(result.role)) {
      failures.push(
        `[${sample.name}] expected role one of [${sample.expectedRoles.join(", ")}], got "${result.role}"`,
      );
    }

    if (sample.forbiddenRoles?.includes(result.role)) {
      failures.push(`[${sample.name}] forbidden role "${result.role}" was returned`);
    }

    for (const skill of sample.expectedSkills) {
      if (!result.detectedSkills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
        failures.push(`[${sample.name}] expected skill "${skill}" not found`);
      }
    }

    if (sample.focusKeywords && sample.focusKeywords.length > 0) {
      const focusText = result.suggestedFocus.join(" ").toLowerCase();
      const hasRelevantFocus = sample.focusKeywords.some((keyword) =>
        focusText.includes(keyword.toLowerCase()),
      );
      if (!hasRelevantFocus && result.suggestedFocus.length === 0) {
        failures.push(`[${sample.name}] expected domain-relevant suggested focus`);
      }
    }
  }

  return { passed: failures.length === 0, failures };
}
