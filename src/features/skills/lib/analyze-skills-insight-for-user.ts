import { getLatestResumeAnalysisForUser } from "@/features/resume/server";

import {
  buildSkillsInsightInput,
  resolveSkillsInsight,
} from "../ai";
import type { SkillsInsightView } from "../types";
import { generateSkillsOverview } from "./generate-skills-overview";
import { getJobAnalysisInputsForSkills } from "./get-job-analysis-inputs-for-skills";
import { getJobSkillsSnapshotsForUser } from "./get-job-skills-snapshots-for-user";
import { mapSkillsInsightToView } from "./map-skills-insight-to-view";
import { saveSkillsInsight } from "./save-skills-insight";

export type AnalyzeSkillsInsightResult =
  | { ok: true; insight: SkillsInsightView }
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

    const input = buildSkillsInsightInput(resume, jobInputs, overview);
    const result = await resolveSkillsInsight(input);

    const saved = await saveSkillsInsight({
      userId,
      resumeAnalysisId: resume.analysisId,
      jobCount: jobInputs.length,
      result,
    });

    return { ok: true, insight: mapSkillsInsightToView(saved) };
  } catch {
    return {
      ok: false,
      message: "Could not generate skills intelligence. Please try again.",
      status: 500,
    };
  }
}
