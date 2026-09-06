import { normalizeToken, sha256 } from "../lib/hash";
import type { JobEvidenceView } from "../types";

export function buildEvidenceFingerprint(input: Pick<JobEvidenceView, "evidenceType" | "evidenceSourceId" | "evidenceLabel" | "matchStrength">): string {
  return sha256(
    [
      input.evidenceType,
      input.evidenceSourceId ?? "",
      normalizeToken(input.evidenceLabel),
      input.matchStrength,
    ].join("|"),
  );
}
