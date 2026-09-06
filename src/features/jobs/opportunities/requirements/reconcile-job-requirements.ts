import { prisma } from "@/server/db/prisma";

import { buildRequirementFingerprint } from "./requirement-fingerprint";
import type { JobRequirementInput } from "../types";

export async function reconcileJobRequirements(input: {
  userId: string;
  jobPostingId: string;
  requirements: JobRequirementInput[];
}) {
  const nextFingerprints = new Set(
    input.requirements.map((requirement) => buildRequirementFingerprint(requirement)),
  );

  const existing = await prisma.jobRequirement.findMany({
    where: { jobPostingId: input.jobPostingId, userId: input.userId },
    select: { id: true, fingerprint: true },
  });

  const staleIds = existing.filter((row) => !nextFingerprints.has(row.fingerprint)).map((row) => row.id);
  if (staleIds.length > 0) {
    await prisma.jobRequirement.deleteMany({ where: { id: { in: staleIds } } });
  }

  const kept = new Map(existing.map((row) => [row.fingerprint, row.id]));
  const results: { id: string; fingerprint: string; input: JobRequirementInput }[] = [];

  for (const requirement of input.requirements) {
    const fingerprint = buildRequirementFingerprint(requirement);
    const existingId = kept.get(fingerprint);
    if (existingId) {
      const updated = await prisma.jobRequirement.update({
        where: { id: existingId },
        data: {
          category: requirement.category,
          importance: requirement.importance,
          normalizedName: requirement.normalizedName,
          rawText: requirement.rawText,
          sourceExcerpt: requirement.sourceExcerpt,
          yearsRequired: requirement.yearsRequired,
          proficiencyRequired: requirement.proficiencyRequired,
          isExplicit: requirement.isExplicit,
        },
      });
      results.push({ id: updated.id, fingerprint, input: requirement });
      continue;
    }

    const created = await prisma.jobRequirement.create({
      data: {
        userId: input.userId,
        jobPostingId: input.jobPostingId,
        category: requirement.category,
        importance: requirement.importance,
        normalizedName: requirement.normalizedName,
        rawText: requirement.rawText,
        sourceExcerpt: requirement.sourceExcerpt,
        yearsRequired: requirement.yearsRequired,
        proficiencyRequired: requirement.proficiencyRequired,
        isExplicit: requirement.isExplicit,
        fingerprint,
      },
    });
    results.push({ id: created.id, fingerprint, input: requirement });
  }

  return results;
}
