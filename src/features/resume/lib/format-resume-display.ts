export function formatResumeFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatAnalyzedDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

export function buildResumeSummaryFallback(input: {
  role: string;
  experienceLevel: string;
  completenessScore: number;
}): string {
  return `${input.role} profile at ${input.experienceLevel} level. Profile completeness: ${input.completenessScore}%.`;
}
