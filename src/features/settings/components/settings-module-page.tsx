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

function SettingsGroup({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="surface-glass p-5" data-testid={id}>
      <h2 className="font-display text-lg" id={`${id}-heading`}>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link
      className="block min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] px-3 py-3 [transition:var(--motion-fade)] hover:border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      href={href}
    >
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{hint}</p>
    </Link>
  );
}

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
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
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

        <div className="relative mx-auto min-w-0 max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-9">
          <header className="space-y-3">
            <Link
              className="text-xs text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              href="/workspace"
            >
              Back to Workspace
            </Link>
            <div>
              <p className="section-eyebrow">Settings</p>
              <h1 className="mt-2 break-words font-display text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Personal workspace controls
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Settings groups existing CareerOS controls. Domain pages remain the source of truth.
              </p>
            </div>
          </header>

          <div className="mt-8 space-y-6">
            <SettingsGroup
              description="Open the canonical planning surfaces. Preferences stay on those pages."
              id="settings-group-planning"
              title="Career Planning"
            >
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <SettingsLink href="/workspace/today" hint="Daily roadmap and streak" label="Today" />
                <SettingsLink href="/workspace/review" hint="Weekly review and Momentum" label="Review" />
                <SettingsLink href="/workspace/resume" hint="Versions and revisions" label="Resume" />
                <SettingsLink href="/workspace/jobs" hint="Saved jobs and discovery" label="Jobs" />
                <SettingsLink href="/workspace/applications" hint="Tracker and next actions" label="Applications" />
              </div>
            </SettingsGroup>

            <SettingsGroup
              description="LinkedIn connection and publishing stay owned by the LinkedIn module."
              id="settings-group-integrations"
              title="Integrations"
            >
              <SettingsLink
                href="/workspace/linkedin/settings"
                hint={`Status: ${data.providerStatus.linkedinStatus.replaceAll("_", " ")}`}
                label="LinkedIn connection"
              />
            </SettingsGroup>

            <SettingsGroup
              description="Memory enablement, suppression, and deletion stay on the Memory page."
              id="settings-group-memory"
              title="Memory & Privacy"
            >
              <SettingsLink
                href="/workspace/memory"
                hint="Review grounded memory, privacy toggles, and delete controls"
                label="Open Memory controls"
              />
            </SettingsGroup>

            <SettingsGroup
              description="CareerOS never claims a provider action that is not actually available."
              id="settings-group-ai"
              title="AI / Provider Status"
            >
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li>AI wording assist: {data.providerStatus.aiConfigured ? "configured" : "not configured (deterministic fallback)"}</li>
                <li>LinkedIn provider mode: {data.providerStatus.linkedinMode}</li>
                <li>
                  Official publish capability:{" "}
                  {data.providerStatus.linkedinPublishAvailable ? "available" : "not available"}
                </li>
              </ul>
            </SettingsGroup>

            <div data-testid="settings-group-export">
              <DataControlsPanel />
            </div>

            <section className="space-y-6" data-testid="settings-group-account">
              <ProfileSettingsForm profile={data.profile} />
              <AccountSummaryPanel accountSummary={data.accountSummary} profile={data.profile} />
              <SignOutButton />
            </section>
          </div>
        </div>
      </div>
    </WorkspaceModuleLayout>
  );
}
