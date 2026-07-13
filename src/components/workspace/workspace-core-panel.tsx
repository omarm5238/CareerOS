"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CareerCore } from "@/components/core/CareerCore";
import type { CareerCoreModuleId } from "@/core/career-core/types";
import { buildWorkspaceAnalyticsLabel, type WorkspaceAnalyticsStatus } from "@/features/analytics";
import type { WorkspaceJobsStatus } from "@/features/jobs";
import { readOnboardingState } from "@/features/onboarding";
import type { WorkspaceProfile } from "@/features/resume";
import { buildWorkspaceSkillsLabel, type WorkspaceSkillsStatus } from "@/features/skills";
import { AnalysisSourceBadge } from "@/features/resume/components/analysis-source-badge";

import { WorkspaceModuleOverlays } from "./workspace-module-overlays";

type WorkspaceCorePanelProps = {
  profile: WorkspaceProfile | null;
  jobsStatus: WorkspaceJobsStatus;
  skillsStatus: WorkspaceSkillsStatus;
  analyticsStatus: WorkspaceAnalyticsStatus;
};

function mapCachedProfileToWorkspaceProfile(): WorkspaceProfile | null {
  const cached = readOnboardingState();
  if (!cached?.completed) return null;

  return {
    role: cached.profile.role,
    experienceLevel: cached.profile.experienceLevel,
    completenessScore: cached.profile.completenessScore,
    filename: cached.resume.filename,
    fileSize: cached.resume.fileSize,
    textLength: 0,
    detectedSkills: cached.profile.detectedSkills,
    profileSummary: cached.profile.profileSummary ?? null,
    analysisSource: cached.profile.analysisSource ?? "rule_based",
  };
}

function buildJobsLabel(jobsStatus: WorkspaceJobsStatus): string {
  if (jobsStatus.count <= 0) return "No saved jobs";

  const base = `${jobsStatus.count} jobs · ${jobsStatus.appliedCount} applied`;

  if (jobsStatus.latestMatchScore !== null) {
    return `${base} · ${jobsStatus.latestMatchScore}%`;
  }

  return base;
}

export function WorkspaceCorePanel({
  profile,
  jobsStatus,
  skillsStatus,
  analyticsStatus,
}: WorkspaceCorePanelProps) {
  const [highlightedModule, setHighlightedModule] = useState<CareerCoreModuleId | null>(
    null,
  );
  const [resolvedProfile, setResolvedProfile] = useState<WorkspaceProfile | null>(profile);

  useEffect(() => {
    if (profile) {
      setResolvedProfile(profile);
      return;
    }

    setResolvedProfile(mapCachedProfileToWorkspaceProfile());
  }, [profile]);

  const hasProfile = !!resolvedProfile;
  const jobsLabel = buildJobsLabel(jobsStatus);
  const skillsLabel = buildWorkspaceSkillsLabel(skillsStatus);
  const analyticsLabel = buildWorkspaceAnalyticsLabel(analyticsStatus);
  const moduleSecondaryLabels: Partial<Record<CareerCoreModuleId, string>> = {
    resume: hasProfile ? "Profile created" : "Upload to begin",
    skills: skillsLabel,
    jobs: jobsLabel,
    analytics: analyticsLabel,
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-6 rounded-[2.5rem] border border-[var(--color-border-subtle)] bg-[linear-gradient(145deg,rgb(17_17_17_/_38%),rgb(10_10_10_/_18%))]" />
      <CareerCore
        animated
        className="absolute inset-6 overflow-hidden rounded-[2.5rem]"
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
        />
      </CareerCore>

      <div className="pointer-events-none absolute inset-6 z-10">
        {hasProfile ? (
          <div className="absolute left-6 top-6 w-[320px] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_76%)] p-4 shadow-[var(--shadow-md)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                Profile status
              </p>
              <AnalysisSourceBadge source={resolvedProfile.analysisSource} />
            </div>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
              {resolvedProfile.role}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {resolvedProfile.experienceLevel}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {resolvedProfile.completenessScore}% profile completeness
            </p>
            {resolvedProfile.profileSummary ? (
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-[var(--color-text-primary)]">
                {resolvedProfile.profileSummary}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-[var(--color-text-primary)]">
              Resume: {resolvedProfile.filename}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Skills detected: {resolvedProfile.detectedSkills.length}
            </p>
            <Link
              className="pointer-events-auto mt-4 inline-flex text-xs font-medium text-[var(--color-accent)] underline-offset-4 [transition:var(--motion-fade)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace/resume"
            >
              View resume analysis
            </Link>
          </div>
        ) : (
          <div className="absolute left-6 top-6 w-[320px] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_76%)] p-4 shadow-[var(--shadow-md)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
              Profile setup
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
              Build your career profile
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Complete onboarding to unlock your first profile baseline.
            </p>
            <Link
              className="pointer-events-auto mt-4 inline-flex rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/onboarding"
            >
              Build your career profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
