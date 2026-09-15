import { createHash } from "node:crypto";

export function linkedinContentFingerprint(input: {
  linkedinPostRevisionId: string;
  finalText: string;
  format: string;
  mediaReferences?: string[];
}): string {
  const canonical = JSON.stringify({
    linkedinPostRevisionId: input.linkedinPostRevisionId,
    finalText: input.finalText,
    format: input.format,
    mediaReferences: input.mediaReferences ?? [],
  });
  return createHash("sha256").update(canonical).digest("hex");
}
