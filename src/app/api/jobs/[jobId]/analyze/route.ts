import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { analyzeJobPostingForUser } from "@/features/jobs/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

    const job = await analyzeJobPostingForUser(session.user.id, jobId.trim());

    if (!job) {
      return NextResponse.json({ message: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch {
    return NextResponse.json(
      { message: "Could not analyze job match. Please try again." },
      { status: 500 },
    );
  }
}
