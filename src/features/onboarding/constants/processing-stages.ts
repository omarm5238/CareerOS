import type { ProcessingStageId } from "../types";

export const onboardingProcessingStages: Array<{
  id: ProcessingStageId;
  label: string;
}> = [
  { id: "reading", label: "Reading document structure" },
  { id: "identifying", label: "Identifying experience and education" },
  { id: "extracting", label: "Extracting skills" },
  { id: "building", label: "Building career profile" },
];
