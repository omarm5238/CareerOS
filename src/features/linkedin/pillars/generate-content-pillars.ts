import { prisma } from "@/server/db/prisma";

import type { LinkedinCareerContext } from "../types";
import { toPrismaJson } from "../lib/json-parsers";
import { isPillarPriority } from "../lib/permissions";

export type PillarSpec = {
  name?: string;
  description?: string;
  priority?: string;
  reason?: string;
  evidenceIds?: string[];
  exampleAngles?: string[];
  audience?: string;
  goal?: string;
};

function slugify(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "pillar"}-${index + 1}`;
}

export async function generateContentPillars(
  userId: string,
  profileId: string,
  specs: PillarSpec[],
  context: LinkedinCareerContext,
) {
  const usable = specs.filter((spec) => spec.name && spec.description).slice(0, 5);
  const padded = usable.length >= 3 ? usable : [
    ...usable,
    {
      name: "Learning in public",
      description: "Share verified learning from current work without claiming mastery.",
      priority: "EXPERIMENTAL",
      exampleAngles: ["A concept I clarified this week"],
    },
  ].slice(0, 5);

  await prisma.linkedinContentPillar.createMany({
    data: padded.map((spec, index) => ({
      userId,
      linkedinGrowthProfileId: profileId,
      name: spec.name!.trim().slice(0, 80),
      slug: slugify(spec.name!, index),
      description: spec.description!.trim().slice(0, 400),
      goal: spec.goal ?? spec.reason ?? null,
      audience: spec.audience ?? "Hiring managers and peer practitioners",
      priority: isPillarPriority(spec.priority)
        ? spec.priority
        : index === 0
          ? "CORE"
          : index === padded.length - 1
            ? "EXPERIMENTAL"
            : "SECONDARY",
      evidenceSourcesJson: toPrismaJson(spec.evidenceIds ?? context.verifiedSkills.slice(0, 3)),
      exampleAnglesJson: toPrismaJson(spec.exampleAngles ?? []),
      isActive: true,
    })),
  });
}
