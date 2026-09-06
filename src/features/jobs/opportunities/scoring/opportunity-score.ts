import type { OpportunityScoreComponents } from "../types";
import { clampScore } from "./evidence-coverage";

export function calculateOpportunityScore(components: OpportunityScoreComponents): number {
  const total =
    components.roleFit * 0.2 +
    components.skillFit * 0.2 +
    components.evidenceFit * 0.2 +
    components.experienceFit * 0.1 +
    components.locationFit * 0.1 +
    components.authorizationFit * 0.1 +
    components.freshnessScore * 0.05 +
    components.applicationEffortScore * 0.05;

  return clampScore(total);
}
