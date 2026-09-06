import { persistGeneratedDraft } from "./create-communication-draft";
import { buildCommunicationContext } from "./build-communication-context";
import { resolveCommunication } from "../ai/resolve-communication";
import type { CommunicationGenerationInput } from "../types";

export async function generateCommunicationDraft(
  userId: string,
  input: CommunicationGenerationInput,
) {
  const context = await buildCommunicationContext(userId, input);
  const resolved = await resolveCommunication(context);
  const persisted = await persistGeneratedDraft({
    userId,
    context,
    output: resolved.output,
    source: resolved.source,
    model: resolved.model,
    aiSource: resolved.aiSource,
  });

  return {
    draftId: persisted.draftId,
    reused: persisted.reused,
    source: resolved.source,
    message: persisted.reused
      ? "A matching draft was just created. Opening that draft."
      : "Communication draft created.",
  };
}
