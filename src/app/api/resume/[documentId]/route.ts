import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { deleteResumeDocumentForUser } from "@/features/resume/server";
import { auth } from "@/server/auth";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const { documentId } = await context.params;
    if (!documentId?.trim()) {
      return NextResponse.json({ message: "Document ID is required." }, { status: 400 });
    }

    const result = await deleteResumeDocumentForUser(session.user.id, documentId.trim());

    if (!result.ok) {
      return NextResponse.json({ message: "Resume analysis not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      nextDocumentId: result.nextDocumentId,
    });
  } catch {
    return NextResponse.json(
      { message: "Could not delete resume analysis. Please try again." },
      { status: 500 },
    );
  }
}
