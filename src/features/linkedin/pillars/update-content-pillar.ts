import { prisma } from "@/server/db/prisma";

import { toPrismaJson } from "../lib/json-parsers";
import { assertOwnedPillar, isPillarPriority, LinkedinAccessError } from "../lib/permissions";
import { toPillarView } from "../lib/views";

export async function updateContentPillar(userId: string, pillarId: string, body: Record<string, unknown>) {
  const pillar = await assertOwnedPillar(userId, pillarId);
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80);
  if (typeof body.description === "string" && body.description.trim()) {
    data.description = body.description.trim().slice(0, 400);
  }
  if (typeof body.goal === "string") data.goal = body.goal.trim() || null;
  if (typeof body.audience === "string") data.audience = body.audience.trim() || null;
  if (isPillarPriority(body.priority)) data.priority = body.priority;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Array.isArray(body.exampleAngles)) data.exampleAnglesJson = toPrismaJson(body.exampleAngles);

  if (Object.keys(data).length === 0) {
    throw new LinkedinAccessError("INVALID_INPUT", "No valid pillar fields to update.");
  }

  const updated = await prisma.linkedinContentPillar.update({
    where: { id: pillar.id },
    data,
  });
  return toPillarView(updated);
}
