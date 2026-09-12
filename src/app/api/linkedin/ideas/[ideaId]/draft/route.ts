import { NextResponse } from "next/server";

import {
  generateLinkedinPostFromIdea,
  handleLinkedinError,
  requireLinkedinUser,
} from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ ideaId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { ideaId } = await context.params;
    return NextResponse.json(await generateLinkedinPostFromIdea(auth.userId, ideaId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
