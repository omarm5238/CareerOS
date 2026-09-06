import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  setActiveCommunicationRevision,
  toCommunicationErrorResponse,
} from "@/features/communications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { draftId } = await context.params;
    if (!draftId?.trim()) {
      return NextResponse.json({ message: "Draft ID is required." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const revisionId = (body as { revisionId?: unknown }).revisionId;
    if (typeof revisionId !== "string" || !revisionId.trim()) {
      return NextResponse.json({ message: "Revision ID is required." }, { status: 400 });
    }

    const result = await setActiveCommunicationRevision(
      session.user.id,
      draftId.trim(),
      revisionId.trim(),
    );
    return NextResponse.json(result);
  } catch (error) {
    const accessError = toCommunicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not switch the active revision." },
      { status: 500 },
    );
  }
}
