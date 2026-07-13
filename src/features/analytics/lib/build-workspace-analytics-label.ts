import type { WorkspaceAnalyticsStatus } from "../types";

export function buildWorkspaceAnalyticsLabel(status: WorkspaceAnalyticsStatus): string {
  if (!status.hasUsableData || status.careerHealthScore === null) {
    return "No data yet";
  }

  const label = status.careerHealthLabel;
  if (label && label !== "Not Enough Data") {
    return `Health ${status.careerHealthScore}% · ${label}`;
  }

  return `Health ${status.careerHealthScore}%`;
}
