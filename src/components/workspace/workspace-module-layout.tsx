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
      <main className="min-h-screen overflow-x-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
        <div className="pointer-events-none fixed inset-0 app-atmosphere" />

        <WorkspaceRail />

        <div className="relative min-h-screen min-w-0 overflow-x-hidden pl-16">
          <section className="flex min-h-screen min-w-0 flex-col">
            <header className="flex min-h-[4.5rem] min-w-0 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[rgb(8_11_20_/_55%)] px-4 py-3 backdrop-blur-xl sm:gap-4 sm:px-7 sm:py-4">
              <div className="min-w-0 flex-1">
                <p className="section-eyebrow">CareerOS</p>
                <h1 className="mt-1 break-words font-display text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-0.5 break-words text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
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
