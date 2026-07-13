import { prisma } from "@/server/db/prisma";

import type { ProfileUpdateInput, UserProfile } from "../types";

export async function updateUserProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<UserProfile | null> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}
