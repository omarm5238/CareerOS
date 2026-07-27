export type InsightFreshness = {
  isStale: boolean;
  staleReason: string | null;
  generatedAt: string | null;
  latestResumeAt: string | null;
  latestJobAt: string | null;
  currentJobCount: number;
  insightJobCount: number | null;
};

export function evaluateInsightFreshness(input: {
  generatedAt: string | Date | null | undefined;
  latestResumeAt?: string | Date | null;
  latestJobAt?: string | Date | null;
  currentJobCount?: number;
  insightJobCount?: number | null;
}): InsightFreshness {
  const generatedAt = toIso(input.generatedAt);
  const latestResumeAt = toIso(input.latestResumeAt);
  const latestJobAt = toIso(input.latestJobAt);
  const currentJobCount = input.currentJobCount ?? 0;
  const insightJobCount =
    typeof input.insightJobCount === "number" ? input.insightJobCount : null;

  if (!generatedAt) {
    return {
      isStale: false,
      staleReason: null,
      generatedAt: null,
      latestResumeAt,
      latestJobAt,
      currentJobCount,
      insightJobCount,
    };
  }

  const generatedMs = Date.parse(generatedAt);
  const reasons: string[] = [];

  if (latestResumeAt && Date.parse(latestResumeAt) > generatedMs) {
    reasons.push("resume data changed after this insight was generated");
  }

  if (latestJobAt && Date.parse(latestJobAt) > generatedMs) {
    reasons.push("saved jobs changed after this insight was generated");
  }

  if (insightJobCount !== null && insightJobCount !== currentJobCount) {
    reasons.push("saved jobs changed after this insight was generated");
  }

  const uniqueReasons = Array.from(new Set(reasons));

  return {
    isStale: uniqueReasons.length > 0,
    staleReason:
      uniqueReasons.length > 0
        ? "Needs refresh. Saved jobs or resume data changed since this was generated."
        : null,
    generatedAt,
    latestResumeAt,
    latestJobAt,
    currentJobCount,
    insightJobCount,
  };
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
