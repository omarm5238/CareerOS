import { inspectAndPlan } from "../form/inspect-form";

export async function startExecutionSession(userId: string, sessionId: string) {
  return inspectAndPlan(userId, sessionId, { navigate: true, fillSafe: true });
}
