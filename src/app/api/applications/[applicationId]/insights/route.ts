import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  assertApplicationOwnedByUser,
  isApplicationInsightType,
  refreshApplicationNextAction,
  resolveApplicationInsight,
  toApplicationErrorResponse,
} from "@/features/applications/server";
import type { ApplicationStagePrep } from "@/features/applications/types";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string }>;
};

const STAGE_FOR_INSIGHT: Record<string, ApplicationStagePrep["stage"]> = {
  SCREENING_PREP: "SCREENING",
  ASSESSMENT_PREP: "ASSESSMENT",
  INTERVIEW_PREP: "INTERVIEW",
  OFFER_REVIEW: "OFFER",
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { applicationId } = await context.params;
    if (!applicationId?.trim()) {
      return NextResponse.json({ message: "Application ID is required." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const record = (body ?? {}) as Record<string, unknown>;

    if (!isApplicationInsightType(record.type)) {
      return NextResponse.json(
        { message: "Provide a valid insight type.", field: "type" },
        { status: 400 },
      );
    }

    await assertApplicationOwnedByUser(session.user.id, applicationId.trim());

    const insight = await resolveApplicationInsight({
      userId: session.user.id,
      applicationId: applicationId.trim(),
      type: record.type,
      stage: STAGE_FOR_INSIGHT[record.type],
      forceRefresh: record.forceRefresh === true,
    });

    if (!insight) {
      return NextResponse.json(
        { message: "Could not build context for this application." },
        { status: 404 },
      );
    }

    if (record.type === "NEXT_ACTION") {
      await refreshApplicationNextAction(session.user.id, applicationId.trim()).catch(() => {});
    }

    return NextResponse.json({
      insightId: insight.id,
      type: insight.type,
      source: insight.source,
      message:
        insight.source === "AI_GENERATED"
          ? "Analysis generated."
          : "Rule-based analysis generated. AI preparation was unavailable.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not generate the analysis. Please try again." },
      { status: 500 },
    );
  }
}
