import { NextResponse } from "next/server";

import {
  correctCareerMemory,
  handleCareerMemoryError,
  readJsonBody,
  requireCareerMemoryUser,
  toMemoryView,
} from "@/features/career-memory/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const body = await readJsonBody(request);
    void body.userId;
    void body.confidence;
    void body.sourceType;
    void body.isUserCorrected;
    const value = typeof body.value === "string" ? body.value : "";
    const memory = await correctCareerMemory(auth.userId, id, value);
    return NextResponse.json({ memory: toMemoryView(memory), message: "Memory corrected." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
