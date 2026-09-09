import { loadOwnedSession, sessionJson } from "../sessions/load-owned-session";
import { selectAdapter } from "../adapters/adapter-registry";
import { getApplicationBrowserRunner } from "../browser/browser-runtime-registry";

export async function validateCurrentStep(userId: string, sessionId: string) {
  const row = await loadOwnedSession(userId, sessionId);
  const { snapshot, plan } = sessionJson(row);
  const unresolved = plan.answers.filter((answer) => {
    const field = snapshot?.fields.find((item) => item.externalId === answer.fieldId);
    if (!field?.required) return false;
    if (answer.classification === "LEGAL" || answer.classification === "CONSENT") return !answer.confirmed;
    if (answer.classification === "FREE_TEXT") return !answer.reviewed;
    if (answer.classification === "SENSITIVE") return !answer.confirmed;
    if (answer.status === "NEEDS_INPUT" || answer.status === "BLOCKED") return true;
    return false;
  });
    if (unresolved.length > 0) {
    return { ok: false, message: "Required fields are still unresolved.", fieldId: unresolved[0]?.fieldId ?? null, recoverableFormat: false };
  }
  const page = getApplicationBrowserRunner().getPage(sessionId);
  if (!page) return { ok: false, message: "Browser is not connected.", fieldId: null, recoverableFormat: false };
  const adapter = selectAdapter(row.provider, row.provider === "GENERIC" && row.executionMode !== "CONFIRMED_BROWSER_SUBMIT");
  return adapter.validateCurrentStep(page);
}
