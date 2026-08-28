import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  createApplicationForJob,
  refreshApplicationNextAction,
  toApplicationErrorResponse,
} from "@/features/applications/server";
import { auth } from "@/server/auth";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const record = (body ?? {}) as Record<string, unknown>;
    const targetJobId = record.targetJobId;

    if (typeof targetJobId !== "string" || !targetJobId.trim()) {
      return NextResponse.json(
        { message: "Target job ID is required.", field: "targetJobId" },
        { status: 400 },
      );
    }

    const result = await createApplicationForJob({
      userId: session.user.id,
      targetJobId: targetJobId.trim(),
      resumeVersionId:
        typeof record.resumeVersionId === "string" ? record.resumeVersionId.trim() : null,
      resumeVersionRevisionId:
        typeof record.resumeVersionRevisionId === "string"
          ? record.resumeVersionRevisionId.trim()
          : null,
    });

    // Deterministic state is already committed; enrichment must never undo it.
    if (!result.reusedExisting) {
      await refreshApplicationNextAction(session.user.id, result.applicationId).catch(() => {});
    }

    return NextResponse.json({
      applicationId: result.applicationId,
      status: result.status,
      resumeLinked: result.resumeLinked,
      resumeWarning: result.resumeWarning,
      message: result.reusedExisting
        ? "You already have a draft application for this job."
        : "Draft application created.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not start an application. Please try again." },
      { status: 500 },
    );
  }
}
