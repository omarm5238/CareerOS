"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApplicationInsightType } from "@/generated/prisma/client";

import type {
  ApplicationInsightDetail,
  ApplicationNextActionContent,
  ApplicationRejectionAnalysis,
  ApplicationStagePrep,
} from "../types";
import {
  ApplicationConfidenceChip,
  ApplicationInsightSourceBadge,
  formatApplicationDateTime,
} from "./application-badges";

type ApplicationNextStepCenterProps = {
  applicationId: string;
  status: string;
  insightType: ApplicationInsightType | null;
  insight: ApplicationInsightDetail | null;
};

const HEADINGS: Partial<Record<ApplicationInsightType, string>> = {
  NEXT_ACTION: "What to do next",
  SCREENING_PREP: "Screening Prep",
  ASSESSMENT_PREP: "Assessment Prep",
  INTERVIEW_PREP: "Interview Prep",
  OFFER_REVIEW: "Offer Review",
  REJECTION_ANALYSIS: "Rejection Review",
};

export function ApplicationNextStepCenter({
  applicationId,
  status,
  insightType,
  insight,
}: ApplicationNextStepCenterProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!insightType) {
    return (
      <section className="surface-glass p-5" id="next-step-center">
        <p className="section-eyebrow">Next Step Center</p>
        {status === "ACCEPTED" ? (
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            Offer accepted. Confirm any remaining documents in Application Details.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            You withdrew from this process. The timeline is preserved.
          </p>
        )}
      </section>
    );
  }

  async function refresh() {
    if (pending || !insightType) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}/insights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: insightType, forceRefresh: true }),
        },
      );

      const body = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(body?.message ?? "That analysis could not be refreshed.");
      }

      router.refresh();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "That analysis could not be refreshed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-glass p-5" id="next-step-center">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">Next Step Center</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
            {HEADINGS[insightType]}
          </h2>
        </div>
        <button className="btn-secondary" disabled={pending} onClick={() => void refresh()} type="button">
          {pending ? "Refreshing…" : insight ? "Refresh analysis" : "Generate analysis"}
        </button>
      </div>

      {!insight ? (
        <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
          {status === "DRAFT"
            ? "Review the linked resume, then mark this application as submitted when you actually send it."
            : "No analysis has been generated yet. Tracking still works without it."}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ApplicationInsightSourceBadge model={insight.model} source={insight.source} />
            <span className="font-mono-meta text-[var(--color-text-secondary)]">
              Generated {formatApplicationDateTime(insight.createdAt)}
            </span>
          </div>
          <InsightBody insight={insight} />
        </>
      )}

      {error ? (
        <p className="mt-3 text-sm text-[var(--color-danger,#e5a3a3)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function InsightBody({ insight }: { insight: ApplicationInsightDetail }) {
  if (insight.type === "REJECTION_ANALYSIS") {
    return <RejectionReview content={insight.content as ApplicationRejectionAnalysis} />;
  }

  if (insight.type === "NEXT_ACTION") {
    const content = insight.content as ApplicationNextActionContent;
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm leading-6 text-[var(--color-text-primary)]">{content.reason}</p>
        {content.evidence.length > 0 ? (
          <StringList heading="Evidence" items={content.evidence} />
        ) : null}
        {content.warnings.length > 0 ? (
          <StringList heading="Notes" items={content.warnings} />
        ) : null}
      </div>
    );
  }

  return <StagePrepView content={insight.content as ApplicationStagePrep} />;
}

function StagePrepView({ content }: { content: ApplicationStagePrep }) {
  const isOffer = content.stage === "OFFER";

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm leading-6 text-[var(--color-text-primary)]">{content.summary}</p>
      <StringList
        heading={isOffer ? "Compensation and conditions to inspect" : "Focus areas"}
        items={content.focusAreas}
      />
      {content.likelyQuestions.length > 0 ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
            {isOffer ? "Questions to clarify" : "Likely questions"}
          </p>
          <ul className="mt-2 space-y-3">
            {content.likelyQuestions.map((item) => (
              <li className="surface-card p-3" key={item.question}>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.question}</p>
                {item.whyLikely ? (
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {isOffer ? `Why this matters: ${item.whyLikely}` : `Why likely: ${item.whyLikely}`}
                  </p>
                ) : null}
                {item.evidenceToUse ? (
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {isOffer
                      ? `Recorded context: ${item.evidenceToUse}`
                      : `Evidence to use: ${item.evidenceToUse}`}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <StringList
        heading={isOffer ? "Documents and conditions to check" : "Evidence to emphasize"}
        items={content.evidenceToEmphasize}
      />
      <StringList
        heading={isOffer ? "Possible negotiation topics" : "Risks"}
        items={content.risks}
      />
      <StringList
        heading={isOffer ? "Next actions" : "Questions to ask"}
        items={content.questionsToAsk}
      />
      <StringList
        heading={isOffer ? "Offer review checklist" : "Checklist"}
        items={content.checklist}
      />
      <StringList heading="Warnings" items={content.warnings} />
    </div>
  );
}

function RejectionReview({ content }: { content: ApplicationRejectionAnalysis }) {
  return (
    <div className="mt-4 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Confirmed reason
        </p>
        {content.confirmedReason ? (
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
            {content.confirmedReason}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            No confirmed rejection reason recorded.
          </p>
        )}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Likely contributing factors
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          These are inferences from your stored CareerOS data, not employer-confirmed reasons.
        </p>
        {content.likelyFactors.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            No likely factors were generated.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {content.likelyFactors.map((factor) => (
              <li className="surface-card p-3" key={factor.factor}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {factor.factor}
                  </p>
                  <ApplicationConfidenceChip confidence={factor.confidence} />
                </div>
                {factor.evidence ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {factor.evidence}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <StringList heading="What worked" items={content.whatWorked} />
      <StringList heading="Lessons" items={content.lessons} />
      <StringList heading="Resume adjustments" items={content.resumeChanges} />
      <StringList heading="Skill actions" items={content.skillActions} />
      <StringList heading="Next steps" items={content.nextActions} />
      <StringList heading="Warnings" items={content.warnings} />
    </div>
  );
}

function StringList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
        {heading}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li className="text-sm leading-6 text-[var(--color-text-secondary)]" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
