import Link from "next/link";

import type { LinkedinPostView } from "../types";
import { LinkedinSubNav } from "./linkedin-sub-nav";

function bucket(date: string | null): "This Week" | "Next Week" | "Later" {
  if (!date) return "Later";
  const when = new Date(date).getTime();
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  if (when <= now + week) return "This Week";
  if (when <= now + 2 * week) return "Next Week";
  return "Later";
}

export function LinkedinCalendarPage({ posts }: { posts: LinkedinPostView[] }) {
  const plans = posts.flatMap((post) =>
    post.publishingPlans
      .filter((plan) => plan.status === "READY" || plan.status === "SCHEDULED")
      .map((plan) => ({ post, plan, group: bucket(plan.plannedPublishAt) })),
  );

  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      {(["This Week", "Next Week", "Later"] as const).map((group) => (
        <section key={group} className="surface-glass mt-4 p-5">
          <p className="section-eyebrow">{group}</p>
          <ul className="mt-3 space-y-2">
            {plans.filter((item) => item.group === group).length === 0 ? (
              <li className="text-sm text-[var(--color-text-secondary)]">Nothing planned.</li>
            ) : (
              plans
                .filter((item) => item.group === group)
                .map((item) => (
                  <li key={item.plan.id}>
                    <Link href={`/workspace/linkedin/posts/${item.post.id}`} className="block rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
                      <p className="text-sm font-medium">{item.post.activeRevision?.hook ?? item.post.objective}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        Frozen Rev {item.plan.revisionNumber} · {item.plan.status} · MANUAL
                      </p>
                    </Link>
                  </li>
                ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
