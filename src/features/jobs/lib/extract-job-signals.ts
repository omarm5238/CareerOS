import { JOB_SKILL_CATALOG } from "../constants";

function normalize(text: string): string {
  return ` ${text.toLowerCase()} `;
}

export function extractJobSkills(text: string): string[] {
  const lower = normalize(text);

  return JOB_SKILL_CATALOG.filter((skill) => {
    const needle = skill.toLowerCase();

    if (needle === "rest api") {
      return lower.includes("rest api") || lower.includes("restful");
    }

    if (needle === "git") {
      return lower.includes(" git ") || lower.includes("github") || lower.includes("gitlab");
    }

    if (needle === "sql") {
      return lower.includes(" sql ") || lower.includes("sql,") || lower.includes("mysql");
    }

    if (needle === "java") {
      return lower.includes(" java ") || lower.includes("java,") || lower.includes("java/");
    }

    return lower.includes(needle);
  });
}

export function extractJobSignals(title: string, description: string): string[] {
  const text = normalize(`${title}\n${description}`);
  const signals: string[] = [];

  if (
    text.includes("frontend") ||
    text.includes("front-end") ||
    text.includes("react") ||
    text.includes("ui ")
  ) {
    signals.push("Frontend");
  }

  if (
    text.includes("backend") ||
    text.includes("back-end") ||
    text.includes("node.js") ||
    text.includes("api ")
  ) {
    signals.push("Backend");
  }

  if (text.includes("full stack") || text.includes("fullstack") || text.includes("full-stack")) {
    signals.push("Full Stack");
  }

  if (
    text.includes("graphic") ||
    text.includes("designer") ||
    text.includes("figma") ||
    text.includes("branding")
  ) {
    signals.push("Design");
  }

  if (text.includes("senior") || text.includes("lead") || text.includes("principal")) {
    signals.push("Senior-level");
  } else if (text.includes("junior") || text.includes("entry") || text.includes("intern")) {
    signals.push("Entry-level");
  } else if (text.includes("mid-level") || text.includes("mid level")) {
    signals.push("Mid-level");
  }

  if (text.includes("remote")) signals.push("Remote");
  if (text.includes("hybrid")) signals.push("Hybrid");

  return [...new Set(signals)];
}
