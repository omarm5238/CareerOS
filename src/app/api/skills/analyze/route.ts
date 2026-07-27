import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { analyzeSkillsInsightForUser } from "@/features/skills/server";
import { auth } from "@/server/auth";

export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const result = await analyzeSkillsInsightForUser(session.user.id);

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    if (result.skipped) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: result.reason,
        message: result.message,
      });
    }

    return NextResponse.json({
      ...result.insight,
      preserved: result.preserved ?? false,
      message: result.message,
    });
  } catch {
    return NextResponse.json(
      { message: "Could not generate skills intelligence. Please try again." },
      { status: 500 },
    );
  }
}
