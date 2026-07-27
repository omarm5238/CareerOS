import { getLatestResumeAnalysisForUser } from "@/features/resume/server";
import { prisma } from "@/server/db/prisma";

import { buildSkillsInsightInput, resolveSkillsInsight } from "../ai";
import type { SkillsInsightView } from "../types";
import { generateSkillsOverview } from "./generate-skills-overview";
import { getJobAnalysisInputsForSkills } from "./get-job-analysis-inputs-for-skills";
import { getJobSkillsSnapshotsForUser } from "./get-job-skills-snapshots-for-user";
import { mapSkillsInsightToView } from "./map-skills-insight-to-view";
import { saveSkillsInsight } from "./save-skills-insight";

export type AnalyzeSkillsInsightResult =
  | {
      ok: true;
      skipped?: false;
      insight: SkillsInsightView;
      preserved?: boolean;
      message?: string;
    }
  | { ok: true; skipped: true; reason: "no_saved_jobs"; message: string }
  | { ok: false; message: string; status: 400 | 404 | 500 };

export async function analyzeSkillsInsightForUser(
  userId: string,
): Promise<AnalyzeSkillsInsightResult> {
  const resume = await getLatestResumeAnalysisForUser(userId);

  if (!resume) {
    return {
      ok: false,
      message: "Upload or analyze a resume first to generate skills intelligence.",
      status: 400,
    };
  }

  try {
    const savedJobsCount = await prisma.jobPosting.count({ where: { userId } });

    if (savedJobsCount === 0) {
      // No market data: do not call AI, do not save a new insight, and clear
      // stale generated strategies so they cannot resurface as current.
      await prisma.skillsInsight.deleteMany({ where: { userId } });

      return {
        ok: true,
        skipped: true,
        reason: "no_saved_jobs",
        message:
          "Add a saved job before generating a market-driven skills strategy.",
      };
    }

    const [jobSnapshots, jobInputs] = await Promise.all([
      getJobSkillsSnapshotsForUser(userId),
      getJobAnalysisInputsForSkills(userId, 5),
    ]);

    const overview = generateSkillsOverview({
      resumeDetectedSkills: resume.detectedSkills,
      resumeRole: resume.role,
      resumeExperienceLevel: resume.experienceLevel,
      resumeCompletenessScore: resume.completenessScore,
      resumeSuggestedFocus: resume.suggestedFocus,
      resumeWeaknesses: resume.weaknesses,
      jobs: jobSnapshots,
    });

    if (jobInputs.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "no_saved_jobs",
        message:
          "Analyze at least one saved job first, then generate the skills strategy.",
      };
    }

    const input = buildSkillsInsightInput(resume, jobInputs, overview);
    const result = await resolveSkillsInsight(input);
    if (result.analysisSource === "rule_based") {
      const previousAi = await prisma.skillsInsight.findFirst({
        where: { userId, analysisSource: "ai" },
        orderBy: { createdAt: "desc" },
      });
      if (previousAi) {
        return {
          ok: true,
          insight: mapSkillsInsightToView(previousAi, {
            isStale: true,
            staleReason: "Saved jobs changed since this strategy was generated.",
          }),
          preserved: true,
          message: "AI refresh failed. Previous AI skills strategy kept.",
        };
      }
    }

    const saved = await saveSkillsInsight({
      userId,
      resumeAnalysisId: resume.analysisId,
      jobCount: jobInputs.length,
      result,
    });

    return {
      ok: true,
      insight: mapSkillsInsightToView(saved),
      message:
        result.analysisSource === "ai"
          ? "Skills strategy updated with AI."
          : "AI strategy was unavailable. A provisional rule-based strategy was saved.",
    };
  } catch {
    return {
      ok: false,
      message: "Could not generate skills intelligence. Please try again.",
      status: 500,
    };
  }
}
