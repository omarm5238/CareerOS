import {
  estimateLearningEffort,
  isTechnicalSkillRequirement,
} from "@/features/shared/insights";
import type { ContextualProjectIdea } from "../types";

type Input = {
  jobId?: string | null;
  jobTitle: string | null;
  company?: string | null;
  missingTechnicalSkills: string[];
  evidenceGaps?: string[];
  mode: "selected" | "all_jobs";
};

const SELECTED_LIMIT = 3;
const ALL_JOBS_LIMIT = 4;

type ProjectFamily =
  | "django-rest-api"
  | "python-backend"
  | "go-http-service"
  | "go-concurrency"
  | "node-rest-api"
  | "php-backend"
  | "dockerized-service"
  | "kubernetes-deployment"
  | "database-migration"
  | "postgres-feature"
  | "git-workflow"
  | "websocket-service"
  | "cloud-deploy"
  | "flutter-feature"
  | "crud-api"
  | "portfolio-proof"
  | "generic-skill-proof";

export function shortJobDisplayTitle(title: string | null | undefined): string | null {
  if (!title?.trim()) return null;
  let value = title.trim();
  value = value.split(/\s+\|\s+/)[0] ?? value;
  value = value.split(/\s+at\s+/i)[0] ?? value;
  // Keep first clause before long location-style dashes only when very long.
  if (value.length > 48) {
    const dash = value.split(/\s+[–—-]\s+/);
    if (dash[0] && dash[0].length >= 12) value = dash[0];
  }
  return value.trim().slice(0, 56);
}

export function buildSelectedJobProjectIdeas(input: Input): ContextualProjectIdea[] {
  const shortTitle = shortJobDisplayTitle(input.jobTitle);
  const technicalSkills = dedupeSkillFamilies(
    input.missingTechnicalSkills
      .map((skill) => skill.trim())
      .filter((skill) => skill && isTechnicalSkillRequirement(skill)),
  );

  const max = input.mode === "selected" ? SELECTED_LIMIT : ALL_JOBS_LIMIT;
  const ideas: ContextualProjectIdea[] = [];
  const seenFamilies = new Set<string>();

  for (const skill of technicalSkills) {
    if (ideas.length >= max) break;
    const built = buildIdeaForSkill(skill, shortTitle, input.mode);
    if (!built) continue;
    if (
      input.mode === "selected" &&
      shortTitle &&
      mentionsForeignStack(built.idea, shortTitle, skill)
    ) {
      continue;
    }
    const key = semanticDedupeKey(built.family, built.idea, input.jobId, input.mode);
    if (seenFamilies.has(key)) continue;
    seenFamilies.add(key);
    ideas.push(built.idea);
  }

  if (ideas.length === 0 && input.evidenceGaps?.length) {
    ideas.push({
      title: "Evidence case study",
      description:
        "Document one real project decision, implementation, and measurable outcome. This creates proof but does not replace professional experience.",
      skillsProved: [],
      outputArtifact: "A concise case study with repository or screenshots",
      estimatedEffort: "Portfolio proof over time",
      whyThisHelps:
        input.mode === "selected" && shortTitle
          ? `Addresses a proof gap for ${shortTitle} without inventing experience.`
          : "Addresses a proof gap across saved jobs without inventing experience.",
    });
  }

  return ideas.slice(0, max);
}

function dedupeSkillFamilies(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const skill of skills) {
    const family = skillFamilyKey(skill);
    if (seen.has(family)) continue;
    seen.add(family);
    result.push(skill);
  }
  return result;
}

function skillFamilyKey(skill: string): string {
  const value = skill.toLowerCase();
  if (/\bdjango\b|drf|django rest/.test(value)) return "django";
  if (/\bpython\b|flask|fastapi/.test(value)) return "python";
  if (/\bgoroutine|concurrency|channel/.test(value)) return "go-concurrency";
  if (/^(go|golang)$/i.test(skill.trim()) || /\bgolang\b/.test(value)) return "go";
  if (/\bnode|express|nestjs\b/.test(value)) return "node";
  if (/\bphp|laravel\b/.test(value)) return "php";
  if (/\bdocker\b/.test(value)) return "docker";
  if (/\bkubernetes|\bk8s\b/.test(value)) return "k8s";
  if (/\bmigration/.test(value)) return "migration";
  if (/\bpostgres|sql|database\b/.test(value)) return "sql";
  if (/\brest(?:ful)?(?:\s+apis?)?\b|\bapi\b/.test(value)) return "rest-api";
  if (/\bgit\b/.test(value)) return "git";
  if (/\bwebsocket/.test(value)) return "websocket";
  if (/\bflutter|dart\b/.test(value)) return "flutter";
  if (/\baws|cloud|terraform\b/.test(value)) return "cloud";
  return value.replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

/** Shared skill-family key for project-idea and action-center dedupe. */
export function skillFamilyKeyForDedupe(skill: string): string {
  return skillFamilyKey(skill);
}

function projectFamilyFromSkill(skill: string): ProjectFamily {
  const value = skill.toLowerCase();
  if (/\bdjango\b|drf|django rest/.test(value)) return "django-rest-api";
  if (/\bpython\b|flask|fastapi/.test(value)) return "python-backend";
  if (/\bgoroutine|concurrency|channel/.test(value)) return "go-concurrency";
  if (/^(go|golang)$/i.test(skill.trim()) || /\bgolang\b/.test(value)) return "go-http-service";
  if (/\bnode|express|nestjs\b/.test(value)) return "node-rest-api";
  if (/\bphp|laravel\b/.test(value)) return "php-backend";
  if (/\bdocker\b/.test(value)) return "dockerized-service";
  if (/\bkubernetes|\bk8s\b/.test(value)) return "kubernetes-deployment";
  if (/\bmigration/.test(value)) return "database-migration";
  if (/\bpostgres|sql|database\b/.test(value)) return "postgres-feature";
  if (/\bgit\b/.test(value)) return "git-workflow";
  if (/\bwebsocket/.test(value)) return "websocket-service";
  if (/\bflutter|dart\b/.test(value)) return "flutter-feature";
  if (/\baws|cloud|terraform\b/.test(value)) return "cloud-deploy";
  if (/\brest(?:ful)?(?:\s+apis?)?\b|\bapi\b|\bbackend\b|\bcrud\b/.test(value)) {
    return "crud-api";
  }
  return "generic-skill-proof";
}

function semanticDedupeKey(
  family: ProjectFamily,
  idea: ContextualProjectIdea,
  jobId: string | null | undefined,
  mode: "selected" | "all_jobs",
): string {
  const titleKey = normalizeArtifact(idea.title);
  const skillKey = normalizeArtifact(idea.skillsProved[0] ?? "");
  const outputFamily = normalizeArtifact(idea.outputArtifact);
  const scope = mode === "selected" ? jobId ?? "selected" : "all";
  // Docker/K8s with the same output collapse together.
  const familyKey =
    (family === "dockerized-service" || family === "kubernetes-deployment") &&
    /container|compose|manifest|deploy/i.test(idea.outputArtifact)
      ? "container-orchestrate"
      : family;
  return `${scope}|${familyKey}|${titleKey}|${skillKey}|${outputFamily}`;
}

function normalizeArtifact(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bfor\s+(target roles|selected(?:\s+target)?\s+job|the selected target job)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

function mentionsForeignStack(
  idea: ContextualProjectIdea,
  selectedJobTitle: string,
  skill: string,
): boolean {
  const blob = `${idea.title} ${idea.description}`.toLowerCase();
  const selected = selectedJobTitle.toLowerCase();
  const skillBlob = skill.toLowerCase();
  const checks: Array<{ stack: RegExp; job: RegExp }> = [
    { stack: /\bdjango|flask|fastapi\b/, job: /\bpython|django|flask|fastapi\b/ },
    { stack: /\bgo(?:lang)?\b/, job: /\bgo(?:lang)?\b/ },
    { stack: /\bflutter|dart\b/, job: /\bflutter|dart|mobile|android|ios\b/ },
    { stack: /\bphp|laravel\b/, job: /\bphp|laravel\b/ },
    { stack: /\bnode(?:\.?js)?|express|nestjs\b/, job: /\bnode|express|nestjs|javascript|typescript\b/ },
  ];
  for (const check of checks) {
    if (check.stack.test(blob) && !check.stack.test(skillBlob) && !check.job.test(selected)) {
      return true;
    }
  }
  return false;
}

function buildIdeaForSkill(
  skill: string,
  shortTitle: string | null,
  mode: "selected" | "all_jobs",
): { family: ProjectFamily; idea: ContextualProjectIdea } | null {
  if (!isTechnicalSkillRequirement(skill)) return null;

  const family = projectFamilyFromSkill(skill);
  const effort = estimateLearningEffort(skill);
  const help =
    mode === "selected" && shortTitle
      ? `Creates inspectable proof of ${skill} for ${shortTitle}.`
      : `Creates inspectable proof of ${skill} for repeated gaps across saved jobs.`;

  const templates: Record<
    ProjectFamily,
    { title: string; description: string; output: string } | null
  > = {
    "django-rest-api": {
      title: "Django REST API with PostgreSQL",
      description:
        "Build a small Django + DRF API with models, serializers, and authenticated endpoints.",
      output: "Django project with migrations, tests, and README",
    },
    "python-backend": {
      title: "Python backend API service",
      description: "Build a small Python API with validation, persistence, and tests.",
      output: "Python repository with tests and run instructions",
    },
    "go-concurrency": {
      title: "Concurrent task processor in Go",
      description:
        "Build a small Go worker using goroutines, cancellation, and bounded concurrency.",
      output: "Go repository with concurrency tests and README",
    },
    "go-http-service": {
      title: "Go REST API service",
      description: "Build a focused Go HTTP service with validation, persistence, and tests.",
      output: "Runnable Go repository with tests",
    },
    "node-rest-api": {
      title: "Node.js REST API",
      description: "Build a small Node API with validation, persistence, and tests.",
      output: "API repository with examples and test output",
    },
    "php-backend": {
      title: "PHP backend API proof",
      description: "Build a small PHP API with validation, persistence, and tests.",
      output: "PHP repository with README and sample requests",
    },
    "dockerized-service": {
      title: "Dockerized service",
      description:
        "Containerize a small service with health checks and a repeatable local workflow.",
      output: "Dockerfile, compose file, and runbook",
    },
    "kubernetes-deployment": {
      title: "Local Kubernetes deployment",
      description:
        "Deploy one small service locally with health checks and configuration; keep scope small.",
      output: "Local manifests and verification runbook",
    },
    "database-migration": {
      title: "Database migration practice",
      description: "Design a schema change, write migrations, and document rollback steps.",
      output: "Migration scripts with before/after notes",
    },
    "postgres-feature": {
      title: "PostgreSQL data feature",
      description:
        "Design a small schema, implement realistic queries, and document indexing decisions.",
      output: "Schema, seed data, query examples, and performance notes",
    },
    "git-workflow": {
      title: "Git collaboration workflow",
      description:
        "Demonstrate branching, focused commits, review notes, and conflict resolution.",
      output: "Repository with clean history and pull-request walkthrough",
    },
    "websocket-service": {
      title: "Live WebSocket dashboard",
      description: "Build a small dashboard that streams and reconnects to live events.",
      output: "Live mini dashboard with README and demo recording",
    },
    "cloud-deploy": {
      title: "Cloud deployment proof",
      description: `Ship one small service using ${skill} with documented setup and teardown.`,
      output: "Infra notes, deploy script, and verification checklist",
    },
    "flutter-feature": {
      title: "Flutter feature flow",
      description:
        "Build two polished app screens with state, validation, and a real API integration.",
      output: "Runnable mobile app feature with screen recording",
    },
    "crud-api": {
      title: `${skill} API proof`,
      description: `Build a small ${skill}-centered API with validation, persistence, and tests.`,
      output: "API repository with examples and test output",
    },
    "portfolio-proof": null,
    "generic-skill-proof": {
      title: `${skill} proof project`,
      description: `Build one small, reviewable feature that demonstrates ${skill}.`,
      output: "Small repository with README, tests, and screenshots",
    },
  };

  const template = templates[family];
  if (!template) return null;

  return {
    family,
    idea: {
      title: template.title,
      description: template.description,
      skillsProved: [skill],
      outputArtifact: template.output,
      estimatedEffort: effort.showHours ? effort.label : effort.label,
      whyThisHelps: help,
    },
  };
}
