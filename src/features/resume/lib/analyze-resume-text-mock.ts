import {
  DATA_SKILL_CATALOG,
  DESIGN_SKILL_CATALOG,
  MARKETING_SKILL_CATALOG,
  SALES_SKILL_CATALOG,
  SOFTWARE_SKILL_CATALOG,
} from "../constants/domain-skills";
import type { ExperienceLevel } from "../types";
import { detectResumeDomain, type ResumeDomain } from "./detect-resume-domain";

type RuleBasedAnalysisBase = {
  role: string;
  experienceLevel: ExperienceLevel;
  completenessScore: number;
  detectedSkills: string[];
  suggestedFocus: string[];
  resume: {
    filename: string;
    fileSize: number;
    textLength: number;
  };
};

function includesAny(text: string, terms: string[]): boolean {
  const padded = ` ${text.toLowerCase()} `;
  return terms.some((term) => padded.includes(` ${term.toLowerCase()} `) || padded.includes(term.toLowerCase()));
}

function detectSkillsFromCatalog(text: string, catalog: readonly string[]): string[] {
  const lowerText = text.toLowerCase();

  return catalog.filter((skill) => {
    const normalizedSkill = skill.toLowerCase();

    if (normalizedSkill === "rest api") {
      return lowerText.includes("rest api") || lowerText.includes("restful");
    }

    if (normalizedSkill === "git") {
      return lowerText.includes(" git ") || lowerText.includes("github") || lowerText.includes("gitlab");
    }

    if (normalizedSkill === "sql") {
      return lowerText.includes(" sql ") || lowerText.includes("sql,") || lowerText.startsWith("sql");
    }

    return lowerText.includes(normalizedSkill);
  });
}

function detectDomainSkills(text: string, domain: ResumeDomain): string[] {
  switch (domain) {
    case "design":
      return detectSkillsFromCatalog(text, DESIGN_SKILL_CATALOG);
    case "marketing":
      return detectSkillsFromCatalog(text, MARKETING_SKILL_CATALOG);
    case "sales":
      return detectSkillsFromCatalog(text, SALES_SKILL_CATALOG);
    case "data":
      return detectSkillsFromCatalog(text, DATA_SKILL_CATALOG);
    case "software":
      return detectSkillsFromCatalog(text, SOFTWARE_SKILL_CATALOG);
    default:
      return [
        ...detectSkillsFromCatalog(text, DESIGN_SKILL_CATALOG),
        ...detectSkillsFromCatalog(text, SOFTWARE_SKILL_CATALOG),
        ...detectSkillsFromCatalog(text, MARKETING_SKILL_CATALOG),
      ].filter((skill, index, array) => array.indexOf(skill) === index);
  }
}

function detectSoftwareRole(text: string): string {
  const lowerText = text.toLowerCase();

  const frontendSignals = includesAny(lowerText, [
    "react",
    "next.js",
    "nextjs",
    "frontend",
    "front-end",
    " ui ",
    "user interface",
  ]);
  const backendSignals = includesAny(lowerText, [
    "node.js",
    "nodejs",
    " api ",
    "postgresql",
    "postgres",
    "backend",
    "back-end",
    "server-side",
  ]);

  if (includesAny(lowerText, ["full stack", "fullstack", "full-stack"])) {
    return "Full Stack Engineer";
  }

  if (frontendSignals && backendSignals) {
    return "Full Stack Engineer";
  }

  if (frontendSignals) {
    return "Frontend Engineer";
  }

  if (backendSignals) {
    return "Backend Engineer";
  }

  if (includesAny(lowerText, ["software engineer", "software developer", "developer"])) {
    return "Software Engineer";
  }

  return "Software Engineer";
}

function detectDesignRole(text: string): string {
  const lowerText = text.toLowerCase();

  if (includesAny(lowerText, ["motion designer", "motion graphics", "after effects"])) {
    return "Motion Designer";
  }

  if (includesAny(lowerText, ["brand designer", "branding", "visual identity", "logo design"])) {
    return "Brand Designer";
  }

  if (includesAny(lowerText, ["ui/visual", "ui visual designer"])) {
    return "UI/Visual Designer";
  }

  if (includesAny(lowerText, ["visual designer", "visual design"])) {
    return "Visual Designer";
  }

  if (includesAny(lowerText, ["graphic designer", "graphic design"])) {
    return "Graphic Designer";
  }

  return "Graphic Designer";
}

function detectMarketingRole(text: string): string {
  const lowerText = text.toLowerCase();

  if (
    includesAny(lowerText, [
      "social media specialist",
      "social media marketing",
      "social media manager",
      "social media design",
    ])
  ) {
    return "Social Media Specialist";
  }

  return "Marketing Specialist";
}

function detectSalesRole(text: string): string {
  const lowerText = text.toLowerCase();

  if (includesAny(lowerText, ["sales specialist", "inside sales", "outside sales"])) {
    return "Sales Specialist";
  }

  return "Sales Representative";
}

function detectRoleByDomain(text: string, domain: ResumeDomain): string {
  switch (domain) {
    case "design":
      return detectDesignRole(text);
    case "software":
      return detectSoftwareRole(text);
    case "marketing":
      return detectMarketingRole(text);
    case "sales":
      return detectSalesRole(text);
    case "data":
      return includesAny(text.toLowerCase(), ["data scientist"]) ? "Data Scientist" : "Data Analyst";
    case "business":
      return includesAny(text.toLowerCase(), ["business analyst"])
        ? "Business Analyst"
        : "Business Professional";
    case "education":
      return "Educator";
    case "healthcare":
      return includesAny(text.toLowerCase(), ["nurse", "nursing"]) ? "Nurse" : "Healthcare Professional";
    case "unknown":
    default:
      return "General Professional";
  }
}

function detectExperienceLevel(text: string): ExperienceLevel {
  const lowerText = text.toLowerCase();

  if (
    includesAny(lowerText, ["senior", "lead", "architect", "6+ years", "6 years", "7+ years", "8+ years"])
  ) {
    return "Senior";
  }

  if (
    includesAny(lowerText, [
      "3+ years",
      "3 years",
      "4+ years",
      "4 years",
      "5+ years",
      "5 years",
      "mid-level",
      "mid level",
      "senior project",
      "lead project",
    ])
  ) {
    return "Mid-Level";
  }

  return "Entry / Junior";
}

function detectCompletenessScore(text: string, detectedSkills: string[]): number {
  const lowerText = text.toLowerCase();
  let score = 30;

  if (/\S+@\S+\.\S+/.test(text) || includesAny(lowerText, ["phone", "mobile", "contact"])) {
    score += 10;
  }

  if (includesAny(lowerText, ["summary", "profile", "objective", "about me", "professional summary"])) {
    score += 10;
  }

  if (includesAny(lowerText, ["experience", "worked", "employment", "internship", "employer", "work history"])) {
    score += 10;
  }

  if (includesAny(lowerText, ["education", "university", "bachelor", "degree", "college", "diploma"])) {
    score += 10;
  }

  if (
    includesAny(lowerText, ["skills", "competencies", "tools", "technologies"]) ||
    detectedSkills.length >= 3
  ) {
    score += 10;
  }

  if (includesAny(lowerText, ["project", "portfolio", "case study", "built", "developed", "created"])) {
    score += 10;
  }

  if (includesAny(lowerText, ["certification", "certified", "license", "licence", "credential"])) {
    score += 10;
  }

  return Math.min(score, 95);
}

function detectSuggestedFocus(text: string, domain: ResumeDomain): string[] {
  const lowerText = text.toLowerCase();
  const suggestions: string[] = [];

  if (domain === "design") {
    if (!includesAny(lowerText, ["case study", "portfolio", "project"])) {
      suggestions.push("Portfolio Case Studies");
    }
    if (!includesAny(lowerText, ["brand identity", "visual identity", "branding system"])) {
      suggestions.push("Brand Identity Systems");
    }
    if (!includesAny(lowerText, ["ui design", "user interface", "ui/visual"])) {
      suggestions.push("UI Design Fundamentals");
    }
    if (!includesAny(lowerText, ["motion", "animation", "after effects"])) {
      suggestions.push("Motion Design");
    }
    if (!includesAny(lowerText, ["client presentation", "pitch", "stakeholder"])) {
      suggestions.push("Client Presentation");
    }
    if (!includesAny(lowerText, ["design process", "workflow", "documentation"])) {
      suggestions.push("Design Process Documentation");
    }
    return suggestions.slice(0, 5);
  }

  if (domain === "software") {
    if (!includesAny(lowerText, ["test", "testing", "jest", "cypress", "unit test"])) {
      suggestions.push("Testing");
    }
    if (!includesAny(lowerText, ["cloud", "aws", "azure", "gcp", "deploy", "deployment", "kubernetes"])) {
      suggestions.push("Cloud Deployment");
    }
    if (!includesAny(lowerText, ["system design", "architecture", "scalable", "distributed"])) {
      suggestions.push("System Design");
    }
    if (!includesAny(lowerText, ["database", "sql", "postgresql", "mongodb", "mysql"])) {
      suggestions.push("Database Design");
    }
    return suggestions.slice(0, 5);
  }

  if (domain === "marketing") {
    if (!includesAny(lowerText, ["analytics", "metrics", "roi", "kpi"])) {
      suggestions.push("Analytics & ROI");
    }
    if (!includesAny(lowerText, ["content strategy", "content plan"])) {
      suggestions.push("Content Strategy");
    }
    if (!includesAny(lowerText, ["campaign", "advertising"])) {
      suggestions.push("Campaign Optimization");
    }
    return suggestions.slice(0, 5);
  }

  if (domain === "sales") {
    if (!includesAny(lowerText, ["crm", "salesforce", "hubspot"])) {
      suggestions.push("CRM Proficiency");
    }
    if (!includesAny(lowerText, ["pipeline", "forecast"])) {
      suggestions.push("Pipeline Management");
    }
    if (!includesAny(lowerText, ["negotiation", "closing"])) {
      suggestions.push("Negotiation Skills");
    }
    return suggestions.slice(0, 5);
  }

  if (domain === "data") {
    if (!includesAny(lowerText, ["visualization", "tableau", "power bi"])) {
      suggestions.push("Data Visualization");
    }
    if (!includesAny(lowerText, ["sql", "query", "database"])) {
      suggestions.push("SQL Proficiency");
    }
    if (!includesAny(lowerText, ["statistics", "statistical"])) {
      suggestions.push("Statistical Analysis");
    }
    return suggestions.slice(0, 5);
  }

  if (!includesAny(lowerText, ["summary", "profile", "objective"])) {
    suggestions.push("Professional Summary");
  }
  if (!includesAny(lowerText, ["achievement", "accomplishment", "result"])) {
    suggestions.push("Achievement Metrics");
  }
  if (!includesAny(lowerText, ["skills", "competencies"])) {
    suggestions.push("Skills Clarity");
  }

  return suggestions.slice(0, 5);
}

export function analyzeResumeTextMock(
  text: string,
  resumeMeta: { filename: string; fileSize: number },
): RuleBasedAnalysisBase {
  const { domain } = detectResumeDomain(text);
  const detectedSkills = detectDomainSkills(text, domain);
  const role = detectRoleByDomain(text, domain);

  return {
    role,
    experienceLevel: detectExperienceLevel(text),
    completenessScore: detectCompletenessScore(text, detectedSkills),
    detectedSkills,
    suggestedFocus: detectSuggestedFocus(text, domain),
    resume: {
      filename: resumeMeta.filename,
      fileSize: resumeMeta.fileSize,
      textLength: text.length,
    },
  };
}

export { detectResumeDomain };
