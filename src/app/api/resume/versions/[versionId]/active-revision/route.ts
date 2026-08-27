import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  setActiveResumeVersionRevision,
  toResumeVersionErrorResponse,
} from "@/features/resume/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ versionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { versionId } = await context.params;
    if (!versionId?.trim()) {
      return NextResponse.json({ message: "Version ID is required." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const revisionId = (body as { revisionId?: unknown } | null)?.revisionId;
    if (typeof revisionId !== "string" || !revisionId.trim()) {
      return NextResponse.json(
        { message: "Revision ID is required.", field: "revisionId" },
        { status: 400 },
      );
    }

    const version = await setActiveResumeVersionRevision(
      session.user.id,
      versionId.trim(),
      revisionId.trim(),
    );

    return NextResponse.json({
      versionId: version.id,
      activeRevisionId: version.activeRevisionId,
      message: "Active revision updated. No revision was deleted.",
    });
  } catch (error) {
    const accessError = toResumeVersionErrorResponse(error);
    if (accessError) {
      return NextResponse.json(
        { message: accessError.message },
        { status: accessError.status },
      );
    }

    return NextResponse.json(
      { message: "Could not change the active revision. Please try again." },
      { status: 500 },
    );
  }
}
