import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { linkApplicationResume, toApplicationErrorResponse } from "@/features/applications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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
    const resumeVersionId = record.resumeVersionId;

    if (typeof resumeVersionId !== "string" || !resumeVersionId.trim()) {
      return NextResponse.json(
        { message: "Resume version ID is required.", field: "resumeVersionId" },
        { status: 400 },
      );
    }

    // Ownership, version/revision consistency and the post-submission lock are
    // all enforced server-side inside this service.
    const updated = await linkApplicationResume({
      userId: session.user.id,
      applicationId: applicationId.trim(),
      resumeVersionId: resumeVersionId.trim(),
      resumeVersionRevisionId:
        typeof record.resumeVersionRevisionId === "string"
          ? record.resumeVersionRevisionId.trim()
          : null,
    });

    return NextResponse.json({
      applicationId: updated.id,
      resumeVersionId: updated.resumeVersionId,
      resumeVersionRevisionId: updated.resumeVersionRevisionId,
      message: "Resume link updated.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not update the linked resume. Please try again." },
      { status: 500 },
    );
  }
}
