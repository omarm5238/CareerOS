"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { WorkspaceProfile } from "@/features/resume";
import { AnalysisSourceBadge } from "@/features/resume/components/analysis-source-badge";

const STORAGE_KEY = "careeros-profile-panel-expanded";

type WorkspaceProfilePanelProps = {
  profile: WorkspaceProfile;
  onExpandedChange?: (expanded: boolean) => void;
};

export function WorkspaceProfilePanel({
  profile,
  onExpandedChange,
}: WorkspaceProfilePanelProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initialExpanded = stored === "true";
    if (initialExpanded) setExpanded(true);
    onExpandedChange?.(initialExpanded);
    setHydrated(true);
  }, [onExpandedChange]);

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, String(next));
      onExpandedChange?.(next);
      return next;
    });
  }

  return (
    <div
      className="pointer-events-auto absolute left-4 top-4 w-[min(100%,240px)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_72%)] p-3 shadow-[var(--shadow-md)] backdrop-blur-xl sm:w-[260px]"
      id={panelId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
            Profile
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {profile.role}
          </p>
        </div>
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse profile panel" : "Expand profile panel"}
          className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_60%)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] [transition:var(--motion-fade)] hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          onClick={toggleExpanded}
          type="button"
        >
          {expanded ? "Less" : "More"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {profile.completenessScore}% complete
        </span>
        <AnalysisSourceBadge source={profile.analysisSource} />
      </div>

      {hydrated && expanded ? (
        <div className="mt-3 space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
          <p className="text-xs text-[var(--color-text-secondary)]">{profile.experienceLevel}</p>
          {profile.profileSummary ? (
            <p className="line-clamp-3 text-xs leading-5 text-[var(--color-text-primary)]">
              {profile.profileSummary}
            </p>
          ) : null}
          <p className="truncate text-xs text-[var(--color-text-primary)]">
            Resume: {profile.filename}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Skills detected: {profile.detectedSkills.length}
          </p>
        </div>
      ) : null}

      <Link
        className="mt-3 inline-flex text-xs font-medium text-[var(--color-accent)] underline-offset-4 [transition:var(--motion-fade)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace/resume"
      >
        View resume analysis
      </Link>
    </div>
  );
}

export function WorkspaceProfileSetupPanel() {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 w-[min(100%,240px)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_72%)] p-3 shadow-[var(--shadow-md)] backdrop-blur-xl sm:w-[260px]">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
        Profile setup
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
        Build your career profile
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
        Complete onboarding to unlock your first profile baseline.
      </p>
      <Link
        className="mt-3 inline-flex rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white shadow-[var(--shadow-accent-glow)] [transition:var(--motion-fade)] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/onboarding"
      >
        Build your career profile
      </Link>
    </div>
  );
}
