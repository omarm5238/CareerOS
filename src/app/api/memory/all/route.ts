import { NextResponse } from "next/server";

import { deleteAllCareerMemory, handleCareerMemoryError, requireCareerMemoryUser } from "@/features/career-memory/server";

export async function DELETE() {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    await deleteAllCareerMemory(auth.userId);
    return NextResponse.json({ message: "All career memory deleted." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
