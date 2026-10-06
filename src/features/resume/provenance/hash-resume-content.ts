import { createHash } from "node:crypto";

/**
 * Conservative identity normalization for source-resume hashing.
 * Line endings, surrounding whitespace, and runs of blank lines are unified.
 * Internal wording, punctuation, and single-space differences are preserved.
 * The filename is not part of the hash.
 */
export function normalizeResumeContentForHash(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function hashResumeContent(text: string): string {
  return createHash("sha256").update(normalizeResumeContentForHash(text), "utf8").digest("hex");
}
