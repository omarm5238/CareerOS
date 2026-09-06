import { normalizeToken, sha256 } from "../lib/hash";
import type { JobRequirementInput } from "../types";

export function buildRequirementFingerprint(input: JobRequirementInput): string {
  return sha256(
    [
      input.category,
      normalizeToken(input.normalizedName),
      input.importance,
      normalizeToken(input.rawText),
    ].join("|"),
  );
}
