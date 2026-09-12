import { NextResponse } from "next/server";

import {
  generateLinkedinPostFromBrief,
  handleLinkedinError,
  listLinkedinPosts,
  readOptionalJsonBody,
  requireLinkedinUser,
} from "@/features/linkedin/server";

export async function GET() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ posts: await listLinkedinPosts(auth.userId) });
  } catch (error) {
    return handleLinkedinError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await generateLinkedinPostFromBrief(auth.userId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
