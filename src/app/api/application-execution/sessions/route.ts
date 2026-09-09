import { NextResponse } from "next/server";

import { createExecutionSession } from "@/features/application-execution/server";
import { handleExecutionError, readJsonBody, requireExecutionUser } from "@/features/application-execution/lib/api-handler";

export async function POST(request: Request) {
  const authResult = await requireExecutionUser();
  if ("error" in authResult) return authResult.error;
  try {
    const body = await readJsonBody(request);
    const applicationPackageId = typeof body.applicationPackageId === "string" ? body.applicationPackageId : "";
    return NextResponse.json(await createExecutionSession(authResult.userId, applicationPackageId));
  } catch (error) {
    return handleExecutionError(error);
  }
}
