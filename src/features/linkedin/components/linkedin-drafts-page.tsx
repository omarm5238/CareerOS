import Link from "next/link";

import type { LinkedinPostView } from "../types";
import { LinkedinSubNav } from "./linkedin-sub-nav";

export function LinkedinDraftsPage({ posts }: { posts: LinkedinPostView[] }) {
  const groups = {
    DRAFT: posts.filter((post) => post.status === "DRAFT" || post.status === "REVIEW"),
    READY: posts.filter((post) => post.status === "READY"),
    SCHEDULED: posts.filter((post) => post.status === "SCHEDULED"),
    PUBLISHED: posts.filter((post) => post.status === "PUBLISHED"),
  };

  return (
    <div className="relative mx-auto module-shell min-w-0 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      {Object.entries(groups).map(([status, items]) => (
        <section key={status} className="surface-glass mt-4 p-5">
          <p className="section-eyebrow">{status}</p>
          <ul className="mt-3 space-y-2">
            {items.length === 0 ? (
              <li className="text-sm text-[var(--color-text-secondary)]">None</li>
            ) : (
              items.map((post) => (
                <li key={post.id}>
                  <Link href={`/workspace/linkedin/posts/${post.id}`} className="block rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
                    <p className="text-sm font-medium">{post.activeRevision?.hook ?? post.objective}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {post.format} · {post.pillarName ?? "No pillar"} · Rev {post.activeRevision?.revisionNumber ?? "—"}
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
