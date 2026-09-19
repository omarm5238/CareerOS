import { NextResponse } from "next/server";

import { getCareerGraphView, handleCareerMemoryError, requireCareerMemoryUser } from "@/features/career-memory/server";

export async function GET() {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ graph: await getCareerGraphView(auth.userId) });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
