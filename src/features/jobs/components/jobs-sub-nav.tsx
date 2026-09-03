"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Saved Jobs", href: "/workspace/jobs" },
  { label: "Discover", href: "/workspace/jobs/discover" },
  { label: "Application Queue", href: "/workspace/jobs/queue" },
] as const;

export function JobsSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Jobs sections" className="flex gap-1 border-b border-[var(--color-border-subtle)]">
      {items.map((item) => {
        const isActive =
          item.href === "/workspace/jobs"
            ? pathname === "/workspace/jobs"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-sm font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              isActive
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
