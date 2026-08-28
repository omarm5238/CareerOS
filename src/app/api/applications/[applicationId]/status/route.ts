import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  isApplicationStatus,
  refreshApplicationNextAction,
  resolveApplicationInsight,
  toApplicationErrorResponse,
  transitionApplicationStatus,
} from "@/features/applications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string }>;
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

    if (!isApplicationStatus(record.status)) {
      return NextResponse.json(
        { message: "Provide a valid application status.", field: "status" },
        { status: 400 },
      );
    }

    // Deterministic transaction first. Nothing below can roll this back.
    const result = await transitionApplicationStatus({
      userId: session.user.id,
      applicationId: applicationId.trim(),
      toStatus: record.status,
      appliedAt: typeof record.appliedAt === "string" ? record.appliedAt : null,
      confirmedRejectionReason:
        typeof record.confirmedRejectionReason === "string"
          ? record.confirmedRejectionReason
          : null,
      confirmedRejectionSource:
        typeof record.confirmedRejectionSource === "string"
          ? record.confirmedRejectionSource
          : null,
      note: typeof record.note === "string" ? record.note : null,
    });

    if (!result.unchanged) {
      // Best-effort enrichment. Failures are swallowed so the status stays saved.
      await refreshApplicationNextAction(session.user.id, result.applicationId).catch(() => {});

      const stagePrepType =
        result.status === "SCREENING"
          ? "SCREENING_PREP"
          : result.status === "ASSESSMENT"
            ? "ASSESSMENT_PREP"
            : result.status === "INTERVIEW"
              ? "INTERVIEW_PREP"
              : result.status === "OFFER"
                ? "OFFER_REVIEW"
                : null;

      if (stagePrepType) {
        await resolveApplicationInsight({
          userId: session.user.id,
          applicationId: result.applicationId,
          type: stagePrepType,
        }).catch(() => null);
      }

      if (result.status === "REJECTED") {
        await resolveApplicationInsight({
          userId: session.user.id,
          applicationId: result.applicationId,
          type: "REJECTION_ANALYSIS",
        }).catch(() => null);
      }
    }

    return NextResponse.json({
      applicationId: result.applicationId,
      status: result.status,
      appliedAt: result.appliedAt,
      resumeVersionMarkedUsed: result.resumeVersionMarkedUsed,
      message: result.unchanged
        ? "This application is already at that stage."
        : "Application stage updated.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not update the application stage. Please try again." },
      { status: 500 },
    );
  }
}
