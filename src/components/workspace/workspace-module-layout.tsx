import type { ReactNode } from "react";

import { CommandPaletteProvider, CommandPaletteTrigger } from "@/components/command-palette";

import { WorkspaceRail } from "./workspace-rail";

type WorkspaceModuleLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function WorkspaceModuleLayout({
  title,
  subtitle,
  children,
}: WorkspaceModuleLayoutProps) {
  return (
    <CommandPaletteProvider>
      <main className="min-h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <div className="pointer-events-none fixed inset-0 app-atmosphere" />

        <WorkspaceRail />

        <div className="relative min-h-screen pl-16">
          <section className="flex min-h-screen min-w-0 flex-col">
            <header className="flex h-18 min-w-0 items-center gap-4 border-b border-[var(--color-border-subtle)] bg-[rgb(8_11_20_/_55%)] px-7 py-4 backdrop-blur-xl">
              <div className="min-w-0 shrink-0">
                <p className="section-eyebrow">CareerOS</p>
                <h1 className="mt-1 font-display text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
                ) : null}
              </div>

              <CommandPaletteTrigger />
            </header>

            {children}
          </section>
        </div>
      </main>
    </CommandPaletteProvider>
  );
}
