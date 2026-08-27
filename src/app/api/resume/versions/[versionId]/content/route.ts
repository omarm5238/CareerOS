import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  toResumeVersionErrorResponse,
  updateResumeVersionContent,
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

    const result = await updateResumeVersionContent(
      session.user.id,
      versionId.trim(),
      body,
    );

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message, field: result.field },
        { status: result.status },
      );
    }

    return NextResponse.json({
      revisionId: result.revisionId,
      revisionNumber: result.revisionNumber,
      message: result.message,
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
      { message: "Could not save your edits. Please try again." },
      { status: 500 },
    );
  }
}
