import { NextResponse } from "next/server";

import { handleCareerMemoryError, refreshCareerMemory, requireCareerMemoryUser } from "@/features/career-memory/server";

export async function POST() {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const result = await refreshCareerMemory(auth.userId, { mode: "REBUILD" });
    return NextResponse.json({ ...result, message: "Memory rebuilt from recent CareerOS history." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
