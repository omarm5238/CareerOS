export type ProviderPageBlock = "JOB_CLOSED" | "DUPLICATE_APPLICATION" | null;

export function detectProviderPageBlock(blob: string): ProviderPageBlock {
  const text = blob.toLowerCase();
  if (/no longer accepting applications|this job is closed|job is no longer available|position has been filled/.test(text)) {
    return "JOB_CLOSED";
  }
  if (/already applied|application already exists|you('ve| have) already submitted|duplicate application/.test(text)) {
    return "DUPLICATE_APPLICATION";
  }
  return null;
}
