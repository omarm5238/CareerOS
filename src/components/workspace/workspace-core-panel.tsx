"use client";

import { useEffect, useState } from "react";

import { CareerCore } from "@/components/core/CareerCore";
import type { CareerCoreModuleId } from "@/core/career-core/types";
import { buildWorkspaceAnalyticsLabel, type WorkspaceAnalyticsStatus } from "@/features/analytics";
import type { WorkspaceJobsStatus } from "@/features/jobs";
import type { WorkspaceProfile } from "@/features/resume";
import { buildWorkspaceSkillsLabel, type WorkspaceSkillsStatus } from "@/features/skills";

import { WorkspaceModuleOverlays } from "./workspace-module-overlays";
import {
  WorkspaceProfilePanel,
  WorkspaceProfileSetupPanel,
} from "./workspace-profile-panel";

type WorkspaceCorePanelProps = {
  profile: WorkspaceProfile | null;
  resumeTruth: "CURRENT" | "NO_ACTIVE_RESUME" | "CURRENT_ANALYSIS_NOT_FOUND";
  jobsStatus: WorkspaceJobsStatus;
  skillsStatus: WorkspaceSkillsStatus;
  analyticsStatus: WorkspaceAnalyticsStatus;
};

function buildJobsLabel(jobsStatus: WorkspaceJobsStatus): string {
  if (jobsStatus.count <= 0) return "No saved jobs";

  const applied = `${jobsStatus.appliedCount} applied`;

  if (jobsStatus.latestMatchScore !== null) {
    return `${applied} · ${jobsStatus.latestMatchScore}%`;
  }

  return applied;
}

export function WorkspaceCorePanel({
  profile,
  resumeTruth,
  jobsStatus,
  skillsStatus,
  analyticsStatus,
}: WorkspaceCorePanelProps) {
  const [highlightedModule, setHighlightedModule] = useState<CareerCoreModuleId | null>(
    null,
  );
  const [profilePanelExpanded, setProfilePanelExpanded] = useState(false);
  const [resolvedProfile, setResolvedProfile] = useState<WorkspaceProfile | null>(profile);

  useEffect(() => {
    if (profile && resumeTruth === "CURRENT") {
      setResolvedProfile(profile);
      return;
    }

    setResolvedProfile(null);
  }, [profile, resumeTruth]);

  const hasProfile = !!resolvedProfile;
  const jobsLabel = buildJobsLabel(jobsStatus);
  const skillsLabel = buildWorkspaceSkillsLabel(skillsStatus);
  const analyticsLabel = buildWorkspaceAnalyticsLabel(analyticsStatus);
  const moduleSecondaryLabels: Partial<Record<CareerCoreModuleId, string>> = {
    resume: hasProfile ? "Profile ready" : "Upload to begin",
    skills: skillsLabel,
    jobs: jobsLabel,
    analytics: analyticsLabel,
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-8 rounded-[2.5rem] border border-[var(--color-border-subtle)] bg-[linear-gradient(145deg,rgb(17_17_17_/_34%),rgb(10_10_10_/_16%))]" />
      <CareerCore
        animated
        className="absolute inset-8 overflow-hidden rounded-[2.5rem]"
        density="medium"
        highlightedModule={highlightedModule}
        interactive
        mode="workspace"
        pulse
      >
        <WorkspaceModuleOverlays
          highlightedModule={highlightedModule}
          moduleSecondaryLabels={moduleSecondaryLabels}
          onHighlight={setHighlightedModule}
          profilePanelExpanded={profilePanelExpanded}
        />
      </CareerCore>

      <div className="pointer-events-none absolute inset-8 z-10">
        {hasProfile ? (
          <WorkspaceProfilePanel
            onExpandedChange={setProfilePanelExpanded}
            profile={resolvedProfile}
          />
        ) : (
          <WorkspaceProfileSetupPanel
            message={resumeTruth === "CURRENT_ANALYSIS_NOT_FOUND" ? "Reanalysis required" : "Fresh resume analysis required"}
          />
        )}
      </div>
    </div>
  );
}
