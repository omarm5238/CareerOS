import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  setResumeVersionStatus,
  toResumeVersionErrorResponse,
} from "@/features/resume/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ versionId: string }>;
};

/** USED is reserved for the Application Tracker and is not exposed here. */
const ALLOWED_STATUSES = ["DRAFT", "READY", "ARCHIVED"] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return (
    typeof value === "string" && (ALLOWED_STATUSES as readonly string[]).includes(value)
  );
}

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

    const status = (body as { status?: unknown } | null)?.status;

    if (!isAllowedStatus(status)) {
      return NextResponse.json(
        { message: "Status must be DRAFT, READY, or ARCHIVED.", field: "status" },
        { status: 400 },
      );
    }

    const version = await setResumeVersionStatus(
      session.user.id,
      versionId.trim(),
      status,
    );

    return NextResponse.json({
      versionId: version.id,
      status: version.status,
      archivedAt: version.archivedAt?.toISOString() ?? null,
      message:
        status === "READY"
          ? "Version marked as ready."
          : status === "ARCHIVED"
          ? "Version archived. It is hidden from default lists but not deleted."
          : "Version moved back to draft.",
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
      { message: "Could not update the version status. Please try again." },
      { status: 500 },
    );
  }
}
