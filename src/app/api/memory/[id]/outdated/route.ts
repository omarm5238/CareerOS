import { NextResponse } from "next/server";

import { handleCareerMemoryError, markCareerMemoryOutdated, requireCareerMemoryUser, toMemoryView } from "@/features/career-memory/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const memory = await markCareerMemoryOutdated(auth.userId, id);
    return NextResponse.json({ memory: toMemoryView(memory), message: "Memory marked outdated." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
