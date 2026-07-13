import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { validateProfileUpdate } from "@/features/settings";
import { updateUserProfile } from "@/features/settings/server";
import { auth } from "@/server/auth";

export async function PATCH(request: Request) {
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

    const validation = validateProfileUpdate(body);
    if (!validation.valid) {
      return NextResponse.json(
        { message: validation.message, field: validation.field },
        { status: 400 },
      );
    }

    const profile = await updateUserProfile(session.user.id, validation.data);

    if (!profile) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json(
      { message: "Could not update profile. Please try again." },
      { status: 500 },
    );
  }
}
