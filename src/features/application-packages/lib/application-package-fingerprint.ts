import { sha256 } from "@/features/jobs/opportunities/lib/hash";

export function buildApplicationPackageFingerprint(input: {
  jobFingerprint: string;
  analysisFingerprint: string;
  requirementSignal: string;
  resumeVersionRevisionId: string | null;
  coverLetterRevisionId: string | null;
  coverLetterContentSignal?: string | null;
  emailRevisionId: string | null;
  requiredInputs: string;
}): string {
  return sha256(
    [
      input.jobFingerprint,
      input.analysisFingerprint,
      input.requirementSignal,
      input.resumeVersionRevisionId ?? "",
      input.coverLetterRevisionId ?? "",
      input.coverLetterContentSignal ?? "",
      input.emailRevisionId ?? "",
      input.requiredInputs,
    ].join("|"),
  );
}
