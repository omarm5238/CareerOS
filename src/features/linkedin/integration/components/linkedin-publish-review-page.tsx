"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CopyPostButton } from "../../components/linkedin-actions";
import type { LinkedinConnectionView } from "../connection/types";
import type { LinkedinPublishReview } from "../publishing/publish-review-types";
import { LinkedinConnectButton } from "./linkedin-connect-button";

export function LinkedinPublishReviewPage({
  planId,
  revisionNumber,
  finalText,
  newerRevisionWarning,
  planStatus,
  connection,
  initialReview,
  prepareError,
}: {
  planId: string;
  revisionNumber: number;
  finalText: string;
  newerRevisionWarning: string | null;
  planStatus: string;
  connection: LinkedinConnectionView;
  initialReview: LinkedinPublishReview | null;
  prepareError: { code: string; message: string } | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState(initialReview);
  const [error, setError] = useState<string | null>(prepareError?.message ?? null);
  const [errorCode, setErrorCode] = useState<string | null>(prepareError?.code ?? null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const publishAvailable = Boolean(review?.officialPublishAvailable);
  const attemptStatus = review?.attemptStatus ?? null;

  useEffect(() => {
    if (review || prepareError || planStatus === "PUBLISHED") return;
    const publish = connection.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST");
    if (publish?.state !== "AVAILABLE") return;
    void (async () => {
      const response = await fetch(`/api/linkedin/publishing-plans/${planId}/prepare`, { method: "POST" });
      const json = (await response.json()) as LinkedinPublishReview & { message?: string; errorCode?: string };
      if (!response.ok) {
        setError(json.message ?? "Could not prepare official publish.");
        setErrorCode(json.errorCode ?? null);
        return;
      }
      setReview(json);
    })();
  }, [connection.capabilities, planId, planStatus, prepareError, review]);

  async function publish() {
    if (!review) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/linkedin/publishing-plans/${planId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: review.attemptId, confirm: true }),
      });
      const json = (await response.json()) as {
        status?: string;
        message?: string;
        errorCode?: string;
        externalLinkedInPostId?: string | null;
      };
      if (!response.ok && json.status !== "FAILED" && json.status !== "UNCERTAIN") {
        setError(json.message ?? "Publish failed.");
        setErrorCode(json.errorCode ?? null);
        return;
      }
      setResult(json.status ?? "FAILED");
      setError(json.status === "PUBLISHED" ? null : json.message ?? null);
      setErrorCode(json.errorCode ?? null);
      if (json.externalLinkedInPostId) {
        setReview({ ...review, attemptStatus: json.status === "PUBLISHED" ? "PUBLISHED" : review.attemptStatus });
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function resolve(action: "CONFIRM_PUBLISHED" | "CONFIRM_NOT_PUBLISHED") {
    if (!review) return;
    setPending(true);
    try {
      await fetch(`/api/linkedin/publishing-attempts/${review.attemptId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative mx-auto module-shell px-6 py-8 lg:px-8 lg:py-9">
      <p className="section-eyebrow">Official publish review</p>
      <h2 className="mt-2 font-display text-2xl">Publishing Revision {revisionNumber}</h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        CareerOS will publish the frozen revision shown here.
      </p>
      {newerRevisionWarning ? <p className="mt-3 text-sm">{newerRevisionWarning}</p> : null}

      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">LinkedIn account</p>
        <p className="mt-2 text-sm">{connection.displayName ?? "Not connected"}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Connection {connection.status}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Official publishing{" "}
          {connection.capabilities.find((item) => item.capability === "PUBLISH_MEMBER_POST")?.state ?? "unavailable"}
        </p>
      </section>

      <section className="surface-glass mt-4 p-5">
        <p className="section-eyebrow">Exact final post</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{finalText}</p>
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Plan {planStatus}</p>
        {attemptStatus ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Attempt {attemptStatus}</p> : null}
        {result === "PUBLISHED" || review?.attemptStatus === "PUBLISHED" ? (
          <p className="mt-2 text-sm">Published to LinkedIn</p>
        ) : null}
      </section>

      {result === "UNCERTAIN" || attemptStatus === "UNCERTAIN" ? (
        <section className="surface-glass mt-4 border border-[var(--color-warning,var(--color-border))] p-5">
          <p className="section-eyebrow">Publishing status uncertain</p>
          <p className="mt-2 text-sm">
            LinkedIn may have received this post, but CareerOS could not verify the result. Do not retry yet to avoid
            creating a duplicate post.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void resolve("CONFIRM_PUBLISHED")}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              Mark as Published Manually
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void resolve("CONFIRM_NOT_PUBLISHED")}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              Mark as Not Published
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{error}</p> : null}

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {publishAvailable && result !== "PUBLISHED" && attemptStatus !== "UNCERTAIN" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void publish()}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm"
          >
            {pending ? "Publishing…" : "Publish to LinkedIn"}
          </button>
        ) : null}
        <CopyPostButton text={finalText} />
        <Link
          href={`/workspace/linkedin/calendar`}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2 text-center text-sm"
        >
          Cancel / Back
        </Link>
      </div>
      {!publishAvailable && result !== "PUBLISHED" ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Official publishing unavailable. Copy and publish manually.
        </p>
      ) : null}
      {errorCode === "LINKEDIN_SCOPE_MISSING" ? (
        <div className="mt-3 max-w-sm">
          <LinkedinConnectButton action="reconnect" label="Reconnect & Grant Permission" />
        </div>
      ) : null}
      {errorCode === "LINKEDIN_REAUTH_REQUIRED" ? (
        <div className="mt-3 max-w-sm">
          <LinkedinConnectButton action="reconnect" label="Reconnect LinkedIn" />
        </div>
      ) : null}
    </div>
  );
}
