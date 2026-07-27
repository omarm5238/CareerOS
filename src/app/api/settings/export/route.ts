import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { exportWorkspaceDataForUser } from "@/features/settings/server";
import { auth } from "@/server/auth";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const data = await exportWorkspaceDataForUser(session.user.id);

    if (!data) {
      return NextResponse.json({ message: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { message: "Could not export workspace data. Please try again." },
      { status: 500 },
    );
  }
}
