import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  refreshApplicationNextAction,
  scheduleApplicationFollowUp,
  toApplicationErrorResponse,
} from "@/features/applications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string }>;
};

const ACTIONS = ["schedule", "clear", "sent"] as const;

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
    const action = record.action;

    if (typeof action !== "string" || !(ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json(
        { message: "Provide a valid follow-up action.", field: "action" },
        { status: 400 },
      );
    }

    const result = await scheduleApplicationFollowUp({
      userId: session.user.id,
      applicationId: applicationId.trim(),
      action: action as (typeof ACTIONS)[number],
      followUpAt: typeof record.followUpAt === "string" ? record.followUpAt : null,
    });

    if (!result.unchanged) {
      await refreshApplicationNextAction(session.user.id, result.applicationId).catch(() => {});
    }

    return NextResponse.json({
      applicationId: result.applicationId,
      followUpAt: result.followUpAt,
      message:
        action === "schedule"
          ? "Follow-up scheduled."
          : action === "sent"
            ? "Follow-up marked as sent."
            : "Follow-up cleared.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not update the follow-up. Please try again." },
      { status: 500 },
    );
  }
}
