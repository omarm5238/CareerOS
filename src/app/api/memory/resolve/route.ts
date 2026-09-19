import { NextResponse } from "next/server";

import {
  handleCareerMemoryError,
  keepExclusiveMemory,
  readJsonBody,
  requireCareerMemoryUser,
  resolveBothRelevant,
} from "@/features/career-memory/server";

export async function POST(request: Request) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readJsonBody(request);
    const leftId = typeof body.leftId === "string" ? body.leftId : "";
    const rightId = typeof body.rightId === "string" ? body.rightId : "";
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "both") {
      return NextResponse.json({ ...(await resolveBothRelevant(auth.userId, leftId, rightId)), message: "Both remain relevant." });
    }
    const keepId = action === "right" ? rightId : leftId;
    const dropId = keepId === leftId ? rightId : leftId;
    await keepExclusiveMemory(auth.userId, keepId, dropId);
    return NextResponse.json({ message: "Focus updated." });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
