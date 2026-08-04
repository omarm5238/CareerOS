import Link from "next/link";

import { CareerCore } from "@/components/core/CareerCore";
import { WorkspaceModuleLayout } from "@/components/workspace/workspace-module-layout";

import type { SettingsModuleData } from "../types";
import { AccountSummaryPanel } from "./account-summary-panel";
import { DataControlsPanel } from "./data-controls-panel";
import { ProfileSettingsForm } from "./profile-settings-form";
import { SettingsEmptyState } from "./settings-empty-state";
import { SignOutButton } from "./sign-out-button";

type SettingsModulePageProps = {
  data: SettingsModuleData | null;
};

export function SettingsModulePage({ data }: SettingsModulePageProps) {
  if (!data) {
    return (
      <WorkspaceModuleLayout title="Settings">
        <SettingsEmptyState />
      </WorkspaceModuleLayout>
    );
  }

  return (
    <WorkspaceModuleLayout title="Settings">
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]">
          <CareerCore
            animated={false}
            className="h-full w-full"
            density="low"
            interactive={false}
            mode="workspace"
            pulse={false}
          />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-8 lg:px-8 lg:py-9">
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace"
            >
              Back to Workspace
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                Settings
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Manage your CareerOS account profile and personal data controls.
              </p>
            </div>
          </header>

          <div className="mt-8 space-y-6">
            <ProfileSettingsForm profile={data.profile} />
            <AccountSummaryPanel
              accountSummary={data.accountSummary}
              profile={data.profile}
            />
            <DataControlsPanel />
            <SignOutButton />
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
