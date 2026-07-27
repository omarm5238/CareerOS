import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { validateUpdateApplicationInput } from "@/features/jobs/lib/validate-update-application-input";
import { deleteJobPostingForUser, updateJobApplicationForUser } from "@/features/jobs/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { jobId } = await context.params;
    if (!jobId?.trim()) {
      return NextResponse.json({ message: "Job ID is required." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const validation = validateUpdateApplicationInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message, field: validation.field },
        { status: 400 },
      );
    }

    const job = await updateJobApplicationForUser(
      session.user.id,
      jobId.trim(),
      validation.data,
    );

    if (!job) {
      return NextResponse.json({ message: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch {
    return NextResponse.json(
      { message: "Could not update application. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { jobId } = await context.params;
    if (!jobId?.trim()) {
      return NextResponse.json({ message: "Job ID is required." }, { status: 400 });
    }

    const deleted = await deleteJobPostingForUser(session.user.id, jobId.trim());

    if (!deleted) {
      return NextResponse.json({ message: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Could not delete job. Please try again." },
      { status: 500 },
    );
  }
}
