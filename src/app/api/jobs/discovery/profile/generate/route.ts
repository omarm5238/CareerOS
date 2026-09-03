import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { upsertDiscoveryProfile } from "@/features/jobs/discovery/lib/update-discovery-profile";
import { getDiscoveryProfileForUser } from "@/features/jobs/discovery/lib/get-discovery-profile";
import { generateSearchProfileWithAi, generateFallbackProfile } from "@/features/jobs/discovery/ai/generate-search-profile";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  const userId = session.user.id;
  const resume = await getLatestResumeAnalysisForUser(userId);

  const existingJobs = await prisma.jobPosting.findMany({
    where: { userId },
    select: { title: true },
    take: 10,
  });

  const input = {
    detectedRole: resume?.role ?? null,
    experienceLevel: resume?.experienceLevel ?? null,
    detectedSkills: Array.isArray(resume?.detectedSkills) ? resume.detectedSkills : [],
    profileSummary: resume?.profileSummary ?? null,
    strengths: Array.isArray(resume?.strengths) ? resume.strengths : [],
    weaknesses: Array.isArray(resume?.weaknesses) ? resume.weaknesses : [],
    existingJobTitles: existingJobs.map(j => j.title),
  };

  const aiResult = await generateSearchProfileWithAi(input);
  const profileData = aiResult.ok ? aiResult.data : generateFallbackProfile(input);

  await upsertDiscoveryProfile(userId, profileData, true);
  const updated = await getDiscoveryProfileForUser(userId);

  return NextResponse.json({
    profile: updated,
    source: aiResult.ok ? "ai" : "rule_based",
  });
}
