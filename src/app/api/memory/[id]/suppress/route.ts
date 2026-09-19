import { NextResponse } from "next/server";

import { handleCareerMemoryError, requireCareerMemoryUser, suppressCareerMemory, toMemoryView } from "@/features/career-memory/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const memory = await suppressCareerMemory(auth.userId, id);
    return NextResponse.json({ memory: toMemoryView(memory), message: "Memory will not be used." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
