export type LinkedinMetricInput = {
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  reposts?: number | null;
  saves?: number | null;
};

export function calculateLinkedinPerformanceMetrics(input: LinkedinMetricInput): {
  engagementCount: number | null;
  engagementRate: number | null;
} {
  const parts = [input.likes, input.comments, input.reposts, input.saves];
  const known = parts.filter((value): value is number => typeof value === "number");
  const engagementCount = known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);

  if (input.impressions == null || input.impressions <= 0 || engagementCount == null) {
    return { engagementCount, engagementRate: null };
  }

  return {
    engagementCount,
    engagementRate: engagementCount / input.impressions,
  };
}

export function assertNonNegativeMetric(name: string, value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw Object.assign(new Error(`${name} must be a non-negative integer or null.`), {
      name: "LinkedinAccessError",
    });
  }
  return value;
}
