import { NextResponse } from "next/server";

import {
  CareerMemoryAccessError,
  deleteCareerMemory,
  getOwnedMemoryView,
  handleCareerMemoryError,
  requireCareerMemoryUser,
} from "@/features/career-memory/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    const memory = await getOwnedMemoryView(auth.userId, id);
    if (!memory) throw new CareerMemoryAccessError("NOT_FOUND", "Memory not found.");
    return NextResponse.json({ memory });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await context.params;
    await deleteCareerMemory(auth.userId, id);
    return NextResponse.json({ message: "Memory deleted." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
