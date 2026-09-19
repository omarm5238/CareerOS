import { prisma } from "@/server/db/prisma";

const EMAIL = "m29-perf@careeros.local";

function datesBack(count: number): string[] {
  const out: string[] = [];
  const start = new Date("2026-09-19T12:00:00.000Z");
  for (let i = 0; i < count; i += 1) {
    const day = new Date(start.getTime() - i * 86_400_000);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

async function datasetCounts(userId: string) {
  return {
    userId,
    jobs: await prisma.jobPosting.count({ where: { userId } }),
    applications: await prisma.application.count({ where: { userId } }),
    resumes: await prisma.resumeVersionRevision.count({ where: { userId } }),
    communications: await prisma.communicationDraft.count({ where: { userId } }),
    linkedin: await prisma.linkedinPost.count({ where: { userId } }),
    roadmaps: await prisma.dailyRoadmap.count({ where: { userId } }),
    reviews: await prisma.weeklyCareerReview.count({ where: { userId } }),
    memories: await prisma.careerMemory.count({ where: { userId } }),
  };
}

export async function seedM29LongTermDataset() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: EMAIL, name: "M29 Perf", emailVerified: false },
    });
  }

  const existingJobs = await prisma.jobPosting.count({ where: { userId: user.id } });
  if (existingJobs >= 200) {
    return { skipped: true, ...(await datasetCounts(user.id)) };
  }

  const jobs = Array.from({ length: 250 }, (_, index) => ({
    userId: user.id,
    title: `Backend Engineer ${index}`,
    company: `Company ${index % 40}`,
    description: "Go PostgreSQL system design",
  }));
  await prisma.jobPosting.createMany({ data: jobs });

  const createdJobs = await prisma.jobPosting.findMany({
    where: { userId: user.id },
    select: { id: true },
    take: 80,
    orderBy: { createdAt: "asc" },
  });
  await prisma.application.createMany({
    data: createdJobs.map((job, index) => ({
      userId: user.id,
      jobPostingId: job.id,
      status: index % 9 === 0 ? ("INTERVIEW" as const) : ("APPLIED" as const),
      source: "MANUAL",
      contextSnapshotJson: { job: { title: `Backend Engineer ${index}`, company: `Company ${index}` } },
    })),
  });

  for (let index = 0; index < 10; index += 1) {
    const created = await prisma.resumeVersion.create({
      data: {
        userId: user.id,
        title: `Resume ${index}`,
        status: index < 3 ? ("READY" as const) : ("DRAFT" as const),
      },
    });
    for (let revision = 1; revision <= 3; revision += 1) {
      await prisma.resumeVersionRevision.create({
        data: {
          userId: user.id,
          resumeVersionId: created.id,
          revisionNumber: revision,
          source: "USER_EDITED",
          contentJson: {},
          keywordCoverageJson: [],
          warningsJson: [],
          changeLogJson: [],
          evidenceNotesJson: [],
          inputSnapshotJson: {},
        },
      });
    }
  }

  await prisma.communicationDraft.createMany({
    data: Array.from({ length: 100 }, (_, index) => ({
      userId: user.id,
      type: "FOLLOW_UP",
      status: index % 4 === 0 ? ("USED" as const) : ("READY" as const),
    })),
  });

  const profile =
    (await prisma.linkedinGrowthProfile.findFirst({ where: { userId: user.id } })) ??
    (await prisma.linkedinGrowthProfile.create({
      data: {
        userId: user.id,
        primaryGoal: "GET_HIRED",
        positioningStatement: "M29 long-term dataset",
        status: "ACTIVE",
      },
    }));
  await prisma.linkedinPost.createMany({
    data: Array.from({ length: 40 }, (_, index) => ({
      userId: user.id,
      linkedinGrowthProfileId: profile.id,
      status: index % 5 === 0 ? ("PUBLISHED" as const) : ("READY" as const),
      objective: "SHOW_EXPERTISE",
      format: "TEXT_POST",
    })),
  });
  const posts = await prisma.linkedinPost.findMany({
    where: { userId: user.id },
    select: { id: true, activeRevisionId: true },
    take: 40,
  });
  for (const post of posts) {
    const revision = await prisma.linkedinPostRevision.create({
      data: {
        userId: user.id,
        linkedinPostId: post.id,
        revisionNumber: 1,
        source: "USER_EDITED",
        hook: "Dataset post",
        body: "Metadata only.",
        tone: "PROFESSIONAL",
        language: "ENGLISH",
        hashtagsJson: [],
        qaStatus: "PASS",
      },
    });
    await prisma.linkedinPost.update({ where: { id: post.id }, data: { activeRevisionId: revision.id } });
    await prisma.linkedinPublishingPlan.create({
      data: {
        userId: user.id,
        linkedinPostId: post.id,
        linkedinPostRevisionId: revision.id,
        status: "READY",
        publishMode: "MANUAL",
      },
    });
  }

  const days = datesBack(90);
  await prisma.dailyRoadmap.createMany({
    data: days.map((localDate) => ({
      userId: user.id,
      localDate,
      timezone: "UTC",
      plannedMinutes: 45,
      contextFingerprint: `m29-${localDate}`,
    })),
    skipDuplicates: true,
  });

  const weekStarts = Array.from({ length: 12 }, (_, index) => {
    const day = new Date("2026-09-14T00:00:00.000Z");
    day.setUTCDate(day.getUTCDate() - index * 7);
    return day.toISOString().slice(0, 10);
  });
  await prisma.weeklyCareerReview.createMany({
    data: weekStarts.map((weekStart) => {
      const end = new Date(`${weekStart}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        userId: user.id,
        weekStartLocalDate: weekStart,
        weekEndLocalDate: end.toISOString().slice(0, 10),
        timezone: "UTC",
        status: "FINALIZED",
        contextFingerprint: `m29-week-${weekStart}`,
        overallMomentumScore: 70,
        overallMomentumBand: "STEADY",
        finalizedAt: new Date(),
      };
    }),
    skipDuplicates: true,
  });

  await prisma.careerMemory.createMany({
    data: Array.from({ length: 150 }, (_, index) => ({
      userId: user.id,
      type: "SKILL_SIGNAL",
      category: "SKILL",
      subjectKey: "skill.has",
      normalizedValueKey: `skill-${index}`,
      normalizedText: `Skill ${index}`,
      semanticKey: `SKILL_SIGNAL:SKILL:skill.has:skill-${index}`,
      status: "ACTIVE",
      confidence: "MEDIUM",
      confidenceScore: 60,
      importance: "MEDIUM",
      firstObservedAt: new Date(),
      lastObservedAt: new Date(),
      sourceType: "M23_JOBS",
    })),
    skipDuplicates: true,
  });
  await prisma.careerGraphEntity.createMany({
    data: [
      { userId: user.id, entityType: "USER", canonicalKey: "user:self", displayName: "You" },
      ...Array.from({ length: 40 }, (_, index) => ({
        userId: user.id,
        entityType: "SKILL" as const,
        canonicalKey: `skill:skill-${index}`,
        displayName: `Skill ${index}`,
      })),
    ],
    skipDuplicates: true,
  });

  return { skipped: false, ...(await datasetCounts(user.id)) };
}
