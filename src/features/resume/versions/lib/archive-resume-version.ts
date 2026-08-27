import { prisma } from "@/server/db/prisma";

import { assertResumeVersionOwnedByUser } from "./resume-version-permissions";

export async function archiveResumeVersion(userId: string, versionId: string) {
  await assertResumeVersionOwnedByUser(userId, versionId);

  return prisma.resumeVersion.update({
    where: { id: versionId },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date(),
    },
  });
}
