"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WorkspaceSettingsLink } from "./workspace-settings-link";

const navItems = [
  { label: "Core", glyph: "C", href: "/workspace" },
  { label: "Today", glyph: "T", href: "/workspace/today" },
  { label: "Review", glyph: "W", href: "/workspace/review" },
  { label: "Resume", glyph: "R", href: "/workspace/resume" },
  { label: "Jobs", glyph: "J", href: "/workspace/jobs" },
  { label: "Applications", glyph: "P", href: "/workspace/applications" },
  { label: "Skills", glyph: "S", href: "/workspace/skills" },
  { label: "Analytics", glyph: "A", href: "/workspace/analytics" },
  { label: "LinkedIn", glyph: "L", href: "/workspace/linkedin" },
] as const;

type WorkspaceModuleLabel = (typeof navItems)[number]["label"];

function resolveActiveModule(pathname: string): WorkspaceModuleLabel | null {
  // Application detail lives under /workspace/applications/[id], so the rail
  // keeps the module highlighted on nested routes too.
  if (pathname.startsWith("/workspace/applications")) return "Applications";

  if (pathname.startsWith("/workspace/jobs")) return "Jobs";
  if (pathname.startsWith("/workspace/linkedin")) return "LinkedIn";
  if (pathname.startsWith("/workspace/today")) return "Today";
  if (pathname.startsWith("/workspace/review")) return "Review";

  switch (pathname) {
    case "/workspace":
      return "Core";
    case "/workspace/resume":
      return "Resume";
    case "/workspace/skills":
      return "Skills";
    case "/workspace/analytics":
      return "Analytics";
    default:
      return null;
  }
}

export function WorkspaceRail() {
  const pathname = usePathname();
  const activeModule = resolveActiveModule(pathname);
  const settingsActive = pathname === "/workspace/settings";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex h-screen w-16 flex-col items-center border-r border-[var(--color-border-subtle)] bg-[rgb(8_10_13_/_82%)] px-2 py-5 backdrop-blur-xl">
      <Link
        className="mb-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--surface-soft-glass-border)] bg-[var(--surface-elevated)] text-[11px] font-semibold text-[var(--color-champagne)] shadow-[var(--shadow-sm)] [transition:var(--motion-fade)] hover:border-[var(--color-champagne)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        href="/workspace"
        title="CareerOS"
      >
        CO
      </Link>

      <nav
        aria-label="Workspace modules"
        className="flex w-full shrink-0 flex-col gap-2"
      >
        {navItems.map((item) => {
          const isActive = activeModule === item.label;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-lg)] border text-[10px] font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                isActive
                  ? "border-[var(--color-border)] bg-[rgb(199_203_209_/_6%)] text-[var(--color-text-primary)]"
                  : "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--surface-soft-glass)] hover:text-[var(--color-text-primary)]"
              }`}
              href={item.href}
              key={item.label}
              title={item.label}
            >
              {item.glyph}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--color-intelligence)]"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1" />

      <div className="mb-20 flex w-full shrink-0 flex-col items-center gap-2 border-t border-[var(--color-border-subtle)] pt-3">
        <WorkspaceSettingsLink isActive={settingsActive} />
        <div
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-[var(--color-intelligence)] opacity-70"
        />
      </div>
    </aside>
  );
}
