import type { WorkspaceAnalyticsStatus } from "@/features/analytics";
import type { WorkspaceJobsStatus } from "@/features/jobs";
import type { WorkspaceProfile } from "@/features/resume";
import type { WorkspaceSkillsStatus } from "@/features/skills";

import { CommandPaletteProvider, CommandPaletteTrigger } from "@/components/command-palette";

import { WorkspaceCorePanel } from "./workspace-core-panel";
import { WorkspaceRail } from "./workspace-rail";

type WorkspaceShellProps = {
  profile: WorkspaceProfile | null;
  jobsStatus: WorkspaceJobsStatus;
  skillsStatus: WorkspaceSkillsStatus;
  analyticsStatus: WorkspaceAnalyticsStatus;
};

export function WorkspaceShell({
  profile,
  jobsStatus,
  skillsStatus,
  analyticsStatus,
}: WorkspaceShellProps) {
  return (
    <CommandPaletteProvider>
      <main className="min-h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_52%_38%,rgb(99_102_241_/_12%),transparent_30%),radial-gradient(circle_at_18%_82%,rgb(245_245_245_/_4%),transparent_22%),linear-gradient(180deg,rgb(17_17_17_/_68%),rgb(10_10_10))]" />

        <WorkspaceRail />

        <div className="relative min-h-screen pl-16">
          <section className="flex min-h-screen min-w-0 flex-col">
            <header className="flex h-18 min-w-0 items-center gap-4 border-b border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_44%)] px-7 py-4 backdrop-blur-xl">
              <div className="min-w-0 shrink-0">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                  CareerOS
                </p>
                <h1 className="mt-1 text-base font-medium tracking-tight">Operating Shell</h1>
              </div>

              <CommandPaletteTrigger />
            </header>

            <WorkspaceCorePanel
              analyticsStatus={analyticsStatus}
              jobsStatus={jobsStatus}
              profile={profile}
              skillsStatus={skillsStatus}
            />
          </section>
        </div>
      </main>
    </CommandPaletteProvider>
  );
}
