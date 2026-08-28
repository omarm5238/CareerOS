import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  toApplicationErrorResponse,
  updateApplicationDetails,
} from "@/features/applications/server";
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

    const updated = await updateApplicationDetails({
      userId: session.user.id,
      applicationId: applicationId.trim(),
      notes: typeof record.notes === "string" || record.notes === null
        ? (record.notes as string | null)
        : undefined,
      companyNotes:
        typeof record.companyNotes === "string" || record.companyNotes === null
          ? (record.companyNotes as string | null)
          : undefined,
      salaryNotes:
        typeof record.salaryNotes === "string" || record.salaryNotes === null
          ? (record.salaryNotes as string | null)
          : undefined,
      documents: record.documents,
    });

    return NextResponse.json({
      applicationId: updated.id,
      message: "Application details saved.",
    });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not save the application details. Please try again." },
      { status: 500 },
    );
  }
}
