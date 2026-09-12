import { createHash } from "node:crypto";

export function sha1Fingerprint(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function normalizeIdeaKey(title: string, angle: string): string {
  return `${title} ${angle}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenOverlap(a: string, b: string): number {
  const left = new Set(normalizeIdeaKey(a, "").split(" ").filter((token) => token.length > 2));
  const right = new Set(normalizeIdeaKey(b, "").split(" ").filter((token) => token.length > 2));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.max(left.size, right.size);
}
