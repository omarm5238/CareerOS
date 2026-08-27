import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  createResumeVersionForJob,
  toResumeVersionErrorResponse,
} from "@/features/resume/server";
import { auth } from "@/server/auth";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const payload = (body ?? {}) as {
      targetJobId?: unknown;
      sourceResumeDocumentId?: unknown;
    };

    const targetJobId =
      typeof payload.targetJobId === "string" ? payload.targetJobId.trim() : "";

    if (!targetJobId) {
      return NextResponse.json(
        { message: "Target job ID is required.", field: "targetJobId" },
        { status: 400 },
      );
    }

    const sourceResumeDocumentId =
      typeof payload.sourceResumeDocumentId === "string" &&
      payload.sourceResumeDocumentId.trim().length > 0
        ? payload.sourceResumeDocumentId.trim()
        : null;

    const result = await createResumeVersionForJob({
      userId: session.user.id,
      targetJobId,
      sourceResumeDocumentId,
    });

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    return NextResponse.json(
      {
        versionId: result.versionId,
        revisionId: result.revisionId,
        source: result.source,
        aiSource: result.aiSource,
        status: result.status,
        message: result.message,
      },
      { status: 201 },
    );
  } catch (error) {
    const accessError = toResumeVersionErrorResponse(error);
    if (accessError) {
      return NextResponse.json(
        { message: accessError.message },
        { status: accessError.status },
      );
    }

    return NextResponse.json(
      { message: "Could not create a tailored resume version. Please try again." },
      { status: 500 },
    );
  }
}
