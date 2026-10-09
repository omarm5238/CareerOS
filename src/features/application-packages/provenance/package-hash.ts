import { createHash } from "node:crypto";

export type SubmissionPackageIdentity = {
  jobPostingId: string;
  jobSnapshotHash: string;
  opportunityAnalysisSnapshotId: string;
  sourceResumeRevisionId: string;
  sourceResumeContentHash: string;
  resumeAnalysisId: string;
  tailoredResumeVersionId: string | null;
  tailoredResumeRevisionId: string | null;
  communicationDraftId: string | null;
  communicationRevisionId: string | null;
  provider: string | null;
};

function part(value: string | null | undefined): string {
  return value ?? "";
}

export function hashSubmissionPackage(input: SubmissionPackageIdentity): string {
  const material = [
    input.jobPostingId,
    input.jobSnapshotHash,
    input.opportunityAnalysisSnapshotId,
    input.sourceResumeRevisionId,
    input.sourceResumeContentHash,
    input.resumeAnalysisId,
    part(input.tailoredResumeVersionId),
    part(input.tailoredResumeRevisionId),
    part(input.communicationDraftId),
    part(input.communicationRevisionId),
    part(input.provider),
  ].join("\n");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function submissionIdempotencyKey(input: {
  userId: string;
  submissionPackageId: string;
  provider: string;
}): string {
  return createHash("sha256")
    .update(`${input.userId}\n${input.submissionPackageId}\n${input.provider}`, "utf8")
    .digest("hex");
}
