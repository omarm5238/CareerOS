import { NextResponse } from "next/server";

import {
  createUserDeclaredMemory,
  getCareerMemoryWorkspace,
  handleCareerMemoryError,
  readJsonBody,
  requireCareerMemoryUser,
  toMemoryView,
} from "@/features/career-memory/server";

export async function GET() {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const workspace = await getCareerMemoryWorkspace(auth.userId);
    return NextResponse.json(workspace);
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readJsonBody(request);
    void body.userId;
    void body.confidence;
    void body.sourceType;
    void body.isUserCorrected;
    void body.status;
    const memory = await createUserDeclaredMemory(auth.userId, body);
    return NextResponse.json({ memory: toMemoryView(memory), message: "Memory saved." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
