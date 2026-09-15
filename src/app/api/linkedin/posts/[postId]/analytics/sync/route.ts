import { NextResponse } from "next/server";

import { handleLinkedinError, requireLinkedinUser, syncOfficialLinkedinPostAnalytics } from "@/features/linkedin/server";

type RouteContext = { params: Promise<{ postId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const { postId } = await context.params;
    return NextResponse.json(await syncOfficialLinkedinPostAnalytics(auth.userId, postId));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
