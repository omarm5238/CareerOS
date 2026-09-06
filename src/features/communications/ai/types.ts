import type { AiDiagnostic } from "@/server/ai";

import type {
  CommunicationContext,
  CommunicationGenerationOutput,
  CommunicationTransformType,
} from "../types";

export type CommunicationAiOutcome =
  | { success: true; payload: CommunicationGenerationOutput; model: string | null }
  | { success: false; diagnostic: AiDiagnostic };

export type CommunicationResolveResult = {
  output: CommunicationGenerationOutput;
  source: "AI_GENERATED" | "RULE_BASED_FALLBACK";
  model: string | null;
  aiSource: string;
};

export type CommunicationTransformInput = {
  context: CommunicationContext;
  transform: CommunicationTransformType;
  sourceSubject: string | null;
  sourceContent: string;
};
