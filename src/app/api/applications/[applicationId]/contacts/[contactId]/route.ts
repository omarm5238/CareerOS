import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  toApplicationErrorResponse,
  updateApplicationContact,
} from "@/features/applications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string; contactId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { applicationId, contactId } = await context.params;
    if (!applicationId?.trim() || !contactId?.trim()) {
      return NextResponse.json(
        { message: "Application and contact IDs are required." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const contact = await updateApplicationContact(
      session.user.id,
      applicationId.trim(),
      contactId.trim(),
      body,
    );

    return NextResponse.json({ contactId: contact.id, message: "Contact updated." });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not update the contact. Please try again." },
      { status: 500 },
    );
  }
}
