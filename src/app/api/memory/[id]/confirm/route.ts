import { NextResponse } from "next/server";

import { confirmCareerMemory, handleCareerMemoryError, requireCareerMemoryUser, toMemoryView } from "@/features/career-memory/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const memory = await confirmCareerMemory(auth.userId, id);
    return NextResponse.json({ memory: toMemoryView(memory), message: "Memory confirmed." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
