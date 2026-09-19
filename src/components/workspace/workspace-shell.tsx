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
      <main className="min-h-screen overflow-x-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <div className="pointer-events-none fixed inset-0 app-atmosphere" />

        <WorkspaceRail />

        <div className="relative min-h-screen min-w-0 overflow-x-hidden pl-16">
          <section className="flex min-h-screen min-w-0 flex-col">
            <header className="flex min-h-[4.5rem] min-w-0 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[rgb(8_10_13_/_72%)] px-4 py-3 backdrop-blur-xl sm:gap-4 sm:px-7 sm:py-4">
              <div className="min-w-0 flex-1">
                <p className="section-eyebrow">CareerOS</p>
                <h1 className="mt-1 break-words text-base font-medium tracking-tight">Operating Shell</h1>
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
