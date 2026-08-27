import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  regenerateResumeVersion,
  toResumeVersionErrorResponse,
} from "@/features/resume/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ versionId: string }>;
};

export const maxDuration = 120;

export async function POST(_request: Request, context: RouteContext) {
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

    const result = await regenerateResumeVersion(session.user.id, versionId.trim());

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      revisionId: result.revisionId,
      revisionNumber: result.revisionNumber,
      source: result.source,
      aiSource: result.aiSource,
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
      { message: "Could not regenerate this version. Existing revisions are unchanged." },
      { status: 500 },
    );
  }
}
