import Link from "next/link";
import type { ReactNode } from "react";

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
              <h1 className="mt-1 text-base font-medium tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
              ) : null}
            </div>

            <div className="ml-auto flex min-w-0 max-w-md shrink items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_54%)] px-3 py-2.5 shadow-[var(--shadow-sm)] sm:gap-3 sm:px-4">
              <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)] opacity-80 sm:block" />
              <p className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                Command CareerOS
              </p>
              <Link
                className="shrink-0 text-[11px] text-[var(--color-text-secondary)] underline-offset-4 [transition:var(--motion-fade)] hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                href="/workspace/settings"
              >
                Settings
              </Link>
              <kbd className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
                CMD K
              </kbd>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
