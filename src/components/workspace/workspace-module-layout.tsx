import Link from "next/link";
import type { ReactNode } from "react";

type WorkspaceModuleLayoutProps = {
  title: string;
  subtitle?: string;
  activeModule?: "Core" | "Resume" | "Jobs" | "Skills" | "Analytics";
  children: ReactNode;
};

const navItems = [
  { label: "Core", glyph: "C", href: "/workspace" },
  { label: "Resume", glyph: "R", href: "/workspace/resume" },
  { label: "Jobs", glyph: "J", href: "/workspace/jobs" },
  { label: "Skills", glyph: "S", href: "/workspace/skills" },
  { label: "Analytics", glyph: "A", href: null },
] as const;

export function WorkspaceModuleLayout({
  title,
  subtitle,
  activeModule = "Resume",
  children,
}: WorkspaceModuleLayoutProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_52%_38%,rgb(99_102_241_/_12%),transparent_30%),radial-gradient(circle_at_18%_82%,rgb(245_245_245_/_4%),transparent_22%),linear-gradient(180deg,rgb(17_17_17_/_68%),rgb(10_10_10))]" />

      <div className="relative flex min-h-screen">
        <aside className="flex w-16 shrink-0 flex-col items-center border-r border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_58%)] px-2 py-5 backdrop-blur-xl">
          <Link
            className="mb-9 flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--surface-soft-glass-border)] bg-[rgb(23_23_23_/_72%)] text-[11px] font-semibold text-[var(--color-accent)] shadow-[var(--shadow-sm)] [transition:var(--motion-fade)] hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            href="/workspace"
          >
            CO
          </Link>

          <nav aria-label="Workspace modules" className="flex flex-1 flex-col gap-2">
            {navItems.map((item) => {
              const isActive = item.label === activeModule;

              if (item.href) {
                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-lg)] border text-[10px] font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                      isActive
                        ? "border-[rgb(99_102_241_/_35%)] bg-[rgb(99_102_241_/_12%)] text-[var(--color-accent)]"
                        : "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--surface-soft-glass)] hover:text-[var(--color-text-primary)]"
                    }`}
                    href={item.href}
                    key={item.label}
                    title={item.label}
                  >
                    {item.glyph}
                  </Link>
                );
              }

              return (
                <div
                  aria-disabled="true"
                  className="flex h-9 w-9 cursor-default items-center justify-center rounded-[var(--radius-lg)] border border-transparent bg-transparent text-[10px] font-medium text-[var(--color-text-secondary)] opacity-45"
                  key={item.label}
                  title={`${item.label} — coming soon`}
                >
                  {item.glyph}
                </div>
              );
            })}
          </nav>

          <div className="mb-1 h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] opacity-70 shadow-[var(--shadow-accent-glow)]" />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-18 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[rgb(10_10_10_/_44%)] px-7 py-4 backdrop-blur-xl">
            <div className="min-w-40">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--color-text-secondary)]">
                CareerOS
              </p>
              <h1 className="mt-1 text-base font-medium tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
              ) : null}
            </div>

            <div className="flex w-full max-w-lg items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[rgb(17_17_17_/_54%)] px-4 py-2.5 shadow-[var(--shadow-sm)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] opacity-80" />
              <p className="flex-1 text-xs text-[var(--color-text-secondary)]">
                Command CareerOS
              </p>
              <kbd className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
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
