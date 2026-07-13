import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { validateJobPostingInput } from "@/features/jobs";
import { createJobPostingForUser } from "@/features/jobs/server";
import { auth } from "@/server/auth";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const validation = validateJobPostingInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message, field: validation.field },
        { status: 400 },
      );
    }

    try {
      const job = await createJobPostingForUser(session.user.id, validation.data);
      return NextResponse.json(job, { status: 201 });
    } catch {
      return NextResponse.json(
        { message: "Could not save job posting. Please try again." },
        { status: 500 },
      );
    }
  } catch {
    return NextResponse.json(
      { message: "Job creation failed. Please try again." },
      { status: 500 },
    );
  }
}
