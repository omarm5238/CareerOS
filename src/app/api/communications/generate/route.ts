import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  generateCommunicationDraft,
  parseGenerationInput,
  toCommunicationErrorResponse,
} from "@/features/communications/server";
import { auth } from "@/server/auth";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const input = parseGenerationInput(body);
    const result = await generateCommunicationDraft(session.user.id, input);

    return NextResponse.json(result);
  } catch (error) {
    const accessError = toCommunicationErrorResponse(error);
    if (accessError) {
      return NextResponse.json({ message: accessError.message }, { status: accessError.status });
    }

    return NextResponse.json(
      { message: "Could not generate this communication. Please try again." },
      { status: 500 },
    );
  }
}
