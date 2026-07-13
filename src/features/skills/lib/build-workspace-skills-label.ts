import type { WorkspaceSkillsStatus } from "../types";

export function buildWorkspaceSkillsLabel(status: WorkspaceSkillsStatus): string {
  if (!status.hasResume || status.detectedCount <= 0) {
    return "No resume skills";
  }

  if (status.gapCount > 0) {
    return `${status.detectedCount} skills · ${status.gapCount} gaps`;
  }

  return `${status.detectedCount} skills`;
}
