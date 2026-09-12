import type { LinkedinPostView } from "../types";
import { CopyPostButton, LinkedinActionButton } from "./linkedin-actions";
import { LinkedinSubNav } from "./linkedin-sub-nav";

export function LinkedinPostWorkspace({ post }: { post: LinkedinPostView }) {
  const revision = post.activeRevision;
  const plan = post.publishingPlans[0] ?? null;
  const copyText = revision ? `${revision.hook}\n\n${revision.body}${revision.cta ? `\n\n${revision.cta}` : ""}` : "";
  const planCopy = plan
    ? post.revisions.find((item) => item.id === plan.revisionId)
    : revision;

  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <LinkedinSubNav />
      <section className="surface-glass mt-6 p-5">
        <p className="section-eyebrow">
          {post.status} · {post.format} · {post.objective}
        </p>
        <h2 className="mt-2 font-display text-xl">{revision?.hook ?? "Untitled draft"}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{revision?.body}</p>
        {revision?.cta ? <p className="mt-3 text-sm">{revision.cta}</p> : null}
        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          Tone {revision?.tone} · {revision?.language} · QA {revision?.qaStatus ?? "not run"} · Pillar {post.pillarName ?? "—"}
        </p>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Evidence and warnings</p>
        <ul className="mt-3 space-y-1 text-sm">
          {(revision?.evidence ?? []).map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
          {(revision?.warnings ?? []).map((item) => (
            <li key={item.code} className="text-[var(--color-text-secondary)]">{item.message}</li>
          ))}
        </ul>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Revision history</p>
        <ul className="mt-3 space-y-2">
          {post.revisions.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>Rev {item.revisionNumber} — {item.source.replaceAll("_", " ")}</span>
              {item.id !== post.activeRevisionId ? (
                <LinkedinActionButton
                  label="Set Active"
                  href={`/api/linkedin/posts/${post.id}/active-revision`}
                  method="PATCH"
                  body={{ revisionId: item.id }}
                />
              ) : (
                <span className="status-chip status-chip--info">Active</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Actions</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <LinkedinActionButton label="Edit" href={`/api/linkedin/posts/${post.id}/edit`} body={{ body: `${revision?.body ?? ""}\n` }} />
          <LinkedinActionButton label="Regenerate" href={`/api/linkedin/posts/${post.id}/generate`} />
          <LinkedinActionButton label="Improve hook" href={`/api/linkedin/posts/${post.id}/transform`} body={{ type: "IMPROVE_HOOK" }} />
          <LinkedinActionButton label="Run QA" href={`/api/linkedin/posts/${post.id}/qa`} />
          <LinkedinActionButton label="Repair" href={`/api/linkedin/posts/${post.id}/repair`} />
          <LinkedinActionButton label="Mark Ready" href={`/api/linkedin/posts/${post.id}/ready`} />
          <LinkedinActionButton label="Create Publishing Plan" href={`/api/linkedin/posts/${post.id}/publishing-plan`} />
          <LinkedinActionButton label="Archive" href={`/api/linkedin/posts/${post.id}/archive`} />
        </div>
      </section>
      {plan ? (
        <section className="surface-glass mt-4 p-5">
          <p className="section-eyebrow">Publishing plan · {plan.status} · MANUAL</p>
          <p className="mt-2 text-sm">Exact frozen revision: {plan.revisionId} (Rev {plan.revisionNumber})</p>
          {plan.newerRevisionWarning ? <p className="mt-2 text-sm">{plan.newerRevisionWarning}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-sm">{planCopy ? `${planCopy.hook}\n\n${planCopy.body}` : ""}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <CopyPostButton text={planCopy ? `${planCopy.hook}\n\n${planCopy.body}` : copyText} />
            <LinkedinActionButton label="Mark Published" href={`/api/linkedin/publishing-plans/${plan.id}/mark-published`} />
            <LinkedinActionButton label="Cancel Plan" href={`/api/linkedin/publishing-plans/${plan.id}/cancel`} />
          </div>
        </section>
      ) : null}
      {post.status === "PUBLISHED" ? (
        <section className="surface-glass mt-4 p-5">
          <p className="section-eyebrow">Published · {post.publishingSource ?? "USER_CONFIRMED"}</p>
          <p className="mt-2 text-sm">Published {post.publishedAt ?? "—"}</p>
          <p className="mt-1 text-sm">LinkedIn URL {post.externalLinkedInUrl || "optional, not set"}</p>
          <p className="mt-1 text-sm">Exact revision {post.publishingPlans.find((item) => item.status === "PUBLISHED")?.revisionId}</p>
          <div className="mt-4">
            <LinkedinActionButton
              label="Add Performance Snapshot"
              href={`/api/linkedin/posts/${post.id}/performance`}
              body={{ likes: 0, comments: 0, impressions: 100 }}
            />
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {post.performances.map((item) => (
              <li key={item.id}>
                {item.capturedAt} · impressions {item.impressions ?? "unknown"} · likes {item.likes ?? "unknown"} · rate{" "}
                {item.engagementRate ?? "n/a"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
