import { createHash } from "crypto";

export function buildScoreContextFingerprint(parts: {
  normalizedTitle: string;
  normalizedCompany: string;
  roleTargets: string[];
  resumeAnalysisId?: string | null;
  skillsContextKey?: string | null;
}): string {
  const input = [
    parts.normalizedTitle,
    parts.normalizedCompany,
    ...parts.roleTargets.sort(),
    parts.resumeAnalysisId ?? "",
    parts.skillsContextKey ?? "",
  ].join("|");

  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}
