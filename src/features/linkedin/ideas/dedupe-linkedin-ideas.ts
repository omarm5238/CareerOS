import { normalizeIdeaKey, sha1Fingerprint, tokenOverlap } from "../lib/fingerprint";

export function ideaFingerprint(title: string, angle: string, contextFingerprint: string): string {
  return sha1Fingerprint(`${normalizeIdeaKey(title, angle)}|${contextFingerprint}`);
}

export function isDuplicateIdea(
  candidate: { title: string; angle: string; fingerprint?: string | null },
  existing: Array<{ title: string; angle: string; contextFingerprint?: string | null }>,
): boolean {
  const candidateKey = normalizeIdeaKey(candidate.title, candidate.angle);
  return existing.some((item) => {
    if (candidate.fingerprint && item.contextFingerprint && candidate.fingerprint === item.contextFingerprint) {
      return true;
    }
    const existingKey = normalizeIdeaKey(item.title, item.angle);
    return (
      candidateKey === existingKey ||
      (tokenOverlap(candidate.title, item.title) >= 0.9 && tokenOverlap(candidate.angle, item.angle) >= 0.75)
    );
  });
}
