import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { addApplicationContact, toApplicationErrorResponse } from "@/features/applications/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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

    const contact = await addApplicationContact(session.user.id, applicationId.trim(), body);

    return NextResponse.json({ contactId: contact.id, message: "Contact added." });
  } catch (error) {
    const accessError = toApplicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not add the contact. Please try again." },
      { status: 500 },
    );
  }
}
