import { calculateLinkedinContentPatterns } from "../insights/calculate-linkedin-content-patterns";

export async function getLinkedinContentBalance(userId: string) {
  const patterns = await calculateLinkedinContentPatterns(userId);
  return {
    publishedCount: patterns.publishedCount,
    confidence: patterns.confidence,
    pillars: patterns.pillars,
  };
}
