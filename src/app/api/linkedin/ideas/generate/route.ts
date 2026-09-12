import { NextResponse } from "next/server";

import {
  generateLinkedinIdeas,
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
} from "@/features/linkedin/server";

export async function POST(request: Request) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readOptionalJsonBody(request);
    return NextResponse.json({ ideas: await generateLinkedinIdeas(auth.userId, body) });
  } catch (error) {
    return handleLinkedinError(error);
  }
}
