import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  addManualApplicationEvent,
  toApplicationErrorResponse,
} from "@/features/applications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string }>;
};

function readMetadata(value: unknown) {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const pick = (key: string) =>
    typeof record[key] === "string" && (record[key] as string).trim().length > 0
      ? (record[key] as string).trim().slice(0, 300)
      : undefined;

  return {
    ...(pick("round") ? { round: pick("round") as string } : {}),
    ...(pick("format") ? { format: pick("format") as string } : {}),
    ...(pick("url") ? { url: pick("url") as string } : {}),
    ...(pick("location") ? { location: pick("location") as string } : {}),
    ...(pick("notes") ? { notes: pick("notes") as string } : {}),
  };
}

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

    // Only non-status event types are accepted here; the service rejects any
    // attempt to move the application through this endpoint.
    const event = await addManualApplicationEvent({
      userId: session.user.id,
      applicationId: applicationId.trim(),
      type: typeof record.type === "string" ? record.type : "",
      title: typeof record.title === "string" ? record.title : null,
      description: typeof record.description === "string" ? record.description : null,
      eventAt: typeof record.eventAt === "string" ? record.eventAt : null,
      metadata: readMetadata(record.metadata),
    });

    return NextResponse.json({
      eventId: event.id,
      message: "Event added to the timeline.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not add the event. Please try again." },
      { status: 500 },
    );
  }
}
