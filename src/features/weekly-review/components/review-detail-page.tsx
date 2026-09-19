"use client";

import { useState } from "react";

import type { WeeklyReviewView } from "../types";
import { ReviewBody } from "./review-page";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Request failed.");
  return payload;
}

export function ReviewDetailClient({ initial }: { initial: WeeklyReviewView }) {
  const [review, setReview] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<WeeklyReviewView>) {
    setBusy(true);
    setError(null);
    try {
      setReview(await task());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto min-w-0 module-shell overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      {error ? <p className="mb-4 text-sm text-[var(--color-champagne)]">{error}</p> : null}
      <ReviewBody
        busy={busy}
        onAdopt={(id) =>
          run(async () => {
            const result = await api<{ review: WeeklyReviewView }>(`/api/weekly-review/recommendations/${id}/adopt`, {
              method: "POST",
              body: "{}",
            });
            return result.review;
          })
        }
        onDismiss={(id) =>
          run(async () => {
            const result = await api<{ review: WeeklyReviewView }>(`/api/weekly-review/recommendations/${id}/dismiss`, {
              method: "POST",
              body: "{}",
            });
            return result.review;
          })
        }
        onFinalize={
          review.status === "DRAFT"
            ? () =>
                run(async () => {
                  const result = await api<{ review: WeeklyReviewView }>(`/api/weekly-review/${review.id}/finalize`, {
                    method: "POST",
                  });
                  return result.review;
                })
            : undefined
        }
        onRefresh={
          review.status === "DRAFT"
            ? () =>
                run(async () => {
                  const result = await api<{ review: WeeklyReviewView }>(`/api/weekly-review/${review.id}/refresh`, {
                    method: "POST",
                  });
                  return result.review;
                })
            : undefined
        }
        review={review}
      />
    </div>
  );
}
