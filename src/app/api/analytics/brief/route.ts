import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { analyzeCareerBriefForUser } from "@/features/analytics/server";
import { auth } from "@/server/auth";

export const maxDuration = 90;

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { jobId?: string }
      | null;
    const result = await analyzeCareerBriefForUser(
      session.user.id,
      body?.jobId,
    );

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      ...result.brief,
      preserved: result.preserved ?? false,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { message: "Could not generate CareerOS Brief. Please try again." },
      { status: 500 },
    );
  }
}
