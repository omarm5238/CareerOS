import { prisma } from "@/server/db/prisma";

import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { recordExecutionEvent } from "./execution-event";
import { loadOwnedSession } from "./load-owned-session";

export async function cancelExecutionSession(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  await getApplicationBrowserRunner().close(sessionId);
  await prisma.applicationExecutionSession.update({
    where: { id: sessionId },
    data: { status: "CANCELLED", cancelledAt: new Date(), lastActivityAt: new Date() },
  });
  await recordExecutionEvent(prisma, {
    userId,
    executionSessionId: sessionId,
    type: "SESSION_CANCELLED",
    message: "Assisted application cancelled. History is preserved.",
  });
  return { sessionId: row.id, status: "CANCELLED" as const };
}
