"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Overview", href: "/workspace/linkedin" },
  { label: "Strategy", href: "/workspace/linkedin/strategy" },
  { label: "Ideas", href: "/workspace/linkedin/ideas" },
  { label: "Drafts", href: "/workspace/linkedin/drafts" },
  { label: "Calendar", href: "/workspace/linkedin/calendar" },
  { label: "Insights", href: "/workspace/linkedin/insights" },
] as const;

export function LinkedinSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="LinkedIn sections" className="flex flex-wrap gap-1 border-b border-[var(--color-border-subtle)]">
      {items.map((item) => {
        const isActive =
          item.href === "/workspace/linkedin"
            ? pathname === "/workspace/linkedin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2.5 text-sm font-medium [transition:var(--motion-fade)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
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
