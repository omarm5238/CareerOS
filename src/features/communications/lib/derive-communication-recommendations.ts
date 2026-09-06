import type { ApplicationEventType, ApplicationStatus } from "@/generated/prisma/client";

import { COMMUNICATION_TYPE_LABELS, type CommunicationRecommendation } from "../types";
import type { CommunicationType } from "@/generated/prisma/client";

export type RecommendationInput = {
  status: ApplicationStatus;
  events: Array<{ type: ApplicationEventType; eventAt: Date }>;
  now?: Date;
};

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function rec(
  type: CommunicationType,
  reason: string,
  primary = false,
): CommunicationRecommendation {
  return {
    type,
    label: COMMUNICATION_TYPE_LABELS[type],
    reason,
    primary,
  };
}

/**
 * Deterministic stage-aware recommendations. INTERVIEW status alone never
 * implies a completed interview.
 */
export function deriveCommunicationRecommendations(
  input: RecommendationInput,
): CommunicationRecommendation[] {
  const now = input.now ?? new Date();
  const interviewCompleted = input.events
    .filter((event) => event.type === "INTERVIEW_COMPLETED")
    .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())[0];
  const offerReceived =
    input.status === "OFFER" || input.events.some((event) => event.type === "OFFER_RECEIVED");

  switch (input.status) {
    case "DRAFT":
      return [
        rec("COVER_LETTER", "Prepare a role-focused cover letter before applying", true),
        rec("APPLICATION_EMAIL", "Draft a short email to accompany the application"),
        rec("RECRUITER_OUTREACH", "Reach out to a hiring contact if you have one"),
      ];
    case "APPLIED":
      return [
        rec("FOLLOW_UP", "Follow up regarding this application", true),
        rec("RECRUITER_OUTREACH", "Contact the recruiter or hiring team"),
      ];
    case "SCREENING":
      return [
        rec("FOLLOW_UP", "Follow up on the screening stage", true),
        rec("RECRUITER_OUTREACH", "Reach the recruiter with a concise update"),
      ];
    case "ASSESSMENT":
      return [
        rec("FOLLOW_UP", "Follow up on the assessment", true),
        rec("GENERAL_PROFESSIONAL_MESSAGE", "Send a professional note about next steps"),
      ];
    case "INTERVIEW": {
      if (interviewCompleted) {
        const elapsed = daysSince(interviewCompleted.eventAt, now);
        const items: CommunicationRecommendation[] = [
          rec("INTERVIEW_THANK_YOU", "Send an interview thank-you", true),
        ];
        if (elapsed >= 2) {
          items.push(
            rec(
              "POST_INTERVIEW_FOLLOW_UP",
              "Follow up after the completed interview",
            ),
          );
        }
        items.push(rec("RECRUITER_OUTREACH", "Contact the recruiter if needed"));
        items.push(
          rec("GENERAL_PROFESSIONAL_MESSAGE", "Send another professional note if needed"),
        );
        return items;
      }
      return [
        rec("RECRUITER_OUTREACH", "Reach the recruiter about the scheduled interview", true),
        rec("GENERAL_PROFESSIONAL_MESSAGE", "Send a professional note if needed"),
      ];
    }
    case "OFFER":
      return [
        rec("OFFER_RESPONSE", "Respond to the offer", true),
      ];
    case "REJECTED":
      return [
        rec(
          "GENERAL_PROFESSIONAL_MESSAGE",
          "Send a professional thank-you or keep-in-touch note",
          true,
        ),
      ];
    case "ACCEPTED":
    case "WITHDRAWN":
      return [
        rec(
          "GENERAL_PROFESSIONAL_MESSAGE",
          "Limited professional follow-up is available for this closed application",
          true,
        ),
      ];
    default:
      return offerReceived
        ? [rec("OFFER_RESPONSE", "Respond to the offer", true)]
        : [rec("GENERAL_PROFESSIONAL_MESSAGE", "Send a professional message")];
  }
}

export function defaultLengthForType(type: CommunicationType): "SHORT" | "STANDARD" | "DETAILED" {
  if (type === "RECRUITER_OUTREACH" || type === "FOLLOW_UP") return "SHORT";
  if (type === "COVER_LETTER") return "STANDARD";
  return "STANDARD";
}
