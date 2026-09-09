import { prisma } from "@/server/db/prisma";

import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";
import { inspectAndPlan } from "../form/inspect-form";
import { recordExecutionEvent } from "./execution-event";
import { loadOwnedSession } from "./load-owned-session";

export async function resumeExecutionSession(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const runner = getApplicationBrowserRunner();
  if (!runner.isAlive(sessionId)) {
    await prisma.applicationExecutionSession.update({
      where: { id: sessionId },
      data: { status: "INTERRUPTED", failureCode: "BROWSER_CRASHED", lastActivityAt: new Date() },
    });
    await recordExecutionEvent(prisma, {
      userId,
      executionSessionId: sessionId,
      type: "SESSION_INTERRUPTED",
      message: "Browser context was missing. Resume will create a new browser and re-inspect.",
    });
  }
  if (row.status === "SUBMITTING" || row.status === "VERIFYING") {
    return inspectAndPlan(userId, sessionId, { navigate: false, fillSafe: false });
  }
  return inspectAndPlan(userId, sessionId, { navigate: true, fillSafe: true });
}
