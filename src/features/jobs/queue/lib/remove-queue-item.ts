import { prisma } from "@/server/db/prisma";

export async function removeQueueItem(
  userId: string,
  queueItemId: string,
): Promise<boolean> {
  const item = await prisma.applicationQueueItem.findFirst({
    where: { id: queueItemId, userId },
    select: { id: true, queueStatus: true },
  });

  if (!item) return false;

  if (item.queueStatus === "HANDED_OFF") return false;

  await prisma.applicationQueueItem.update({
    where: { id: item.id },
    data: { queueStatus: "DISMISSED" },
  });

  return true;
}
