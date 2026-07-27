import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { clearGeneratedInsightsForUser } from "@/features/settings/server";
import { auth } from "@/server/auth";

export async function DELETE() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const result = await clearGeneratedInsightsForUser(session.user.id);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch {
    return NextResponse.json(
      { message: "Could not clear generated insights. Please try again." },
      { status: 500 },
    );
  }
}
