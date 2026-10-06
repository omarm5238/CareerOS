import { createHash } from "node:crypto";

export const OPPORTUNITY_ANALYZER_VERSION = "opportunity-analysis-v1";

function normalizeJobField(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashJobSnapshot(job: {
  title: string;
  company: string;
  location?: string | null;
  description: string;
}): string {
  const material = [
    normalizeJobField(job.title),
    normalizeJobField(job.company),
    normalizeJobField(job.location),
    normalizeJobField(job.description),
  ].join("\n---\n");
  return createHash("sha256").update(material, "utf8").digest("hex");
}
