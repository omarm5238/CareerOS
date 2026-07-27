import { getCareerOsReportDataForUser } from "@/features/report/server";
import { prisma } from "@/server/db/prisma";

function parseJsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

export async function exportWorkspaceDataForUser(userId: string) {
  const [profile, resumeDocuments, jobPostings, skillsInsights, careerBriefs, report] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.resumeDocument.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { analysis: true },
      }),
      prisma.jobPosting.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { analysis: true },
      }),
      prisma.skillsInsight.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.careerBrief.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      getCareerOsReportDataForUser(userId),
    ]);

  if (!profile) {
    return null;
  }

  return {
    app: "CareerOS",
    version: "0.1.0",
    generatedAt: new Date().toISOString(),
    profile: {
      name: profile.name,
      email: profile.email,
      createdAt: profile.createdAt.toISOString(),
    },
    resumeDocuments: resumeDocuments.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      textLength: doc.textLength,
      textPreview: doc.textPreview,
      createdAt: doc.createdAt.toISOString(),
      analysis: doc.analysis
        ? {
            id: doc.analysis.id,
            detectedRole: doc.analysis.detectedRole,
            experienceLevel: doc.analysis.experienceLevel,
            completenessScore: doc.analysis.completenessScore,
            detectedSkills: parseJsonArray(doc.analysis.detectedSkills),
            suggestedFocus: parseJsonArray(doc.analysis.suggestedFocus),
            warnings: parseJsonArray(doc.analysis.warnings),
            profileSummary: doc.analysis.profileSummary,
            strengths: parseJsonArray(doc.analysis.strengths),
            weaknesses: parseJsonArray(doc.analysis.weaknesses),
            atsRecommendations: parseJsonArray(doc.analysis.atsRecommendations),
            analysisSource: doc.analysis.analysisSource,
            aiModel: doc.analysis.aiModel,
            createdAt: doc.analysis.createdAt.toISOString(),
          }
        : null,
    })),
    jobPostings: jobPostings.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      jobUrl: job.jobUrl,
      source: job.source,
      applicationStatus: job.applicationStatus,
      applicationNotes: job.applicationNotes,
      appliedAt: job.appliedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      description: job.description,
      analysis: job.analysis
        ? {
            id: job.analysis.id,
            matchScore: job.analysis.matchScore,
            roleAlignment: job.analysis.roleAlignment,
            matchedSkills: parseJsonArray(job.analysis.matchedSkills),
            missingSkills: parseJsonArray(job.analysis.missingSkills),
            resumeSignals: parseJsonArray(job.analysis.resumeSignals),
            jobSignals: parseJsonArray(job.analysis.jobSignals),
            recommendations: parseJsonArray(job.analysis.recommendations),
            analysisSource: job.analysis.analysisSource,
            aiModel: job.analysis.aiModel,
            fitSummary: job.analysis.fitSummary,
            applicationStrategy: parseJsonArray(job.analysis.applicationStrategy),
            resumeTailoringTips: parseJsonArray(job.analysis.resumeTailoringTips),
            createdAt: job.analysis.createdAt.toISOString(),
          }
        : null,
    })),
    skillsInsights: skillsInsights.map((insight) => ({
      id: insight.id,
      analysisSource: insight.analysisSource,
      aiModel: insight.aiModel,
      skillCoverageScore: insight.skillCoverageScore,
      jobCount: insight.jobCount,
      prioritySkills: parseJsonArray(insight.prioritySkills),
      learningRoadmap: parseJsonArray(insight.learningRoadmap),
      projectIdeas: parseJsonArray(insight.projectIdeas),
      resumeSkillAdvice: parseJsonArray(insight.resumeSkillAdvice),
      marketSignals: parseJsonArray(insight.marketSignals),
      warnings: parseJsonArray(insight.warnings),
      createdAt: insight.createdAt.toISOString(),
    })),
    careerBriefs: careerBriefs.map((brief) => ({
      id: brief.id,
      analysisSource: brief.analysisSource,
      aiModel: brief.aiModel,
      healthScore: brief.healthScore,
      headline: brief.headline,
      summary: brief.summary,
      topRisks: parseJsonArray(brief.topRisks),
      topOpportunities: parseJsonArray(brief.topOpportunities),
      nextActions: parseJsonArray(brief.nextActions),
      thirtyDayPlan: brief.thirtyDayPlan,
      actionCenter: parseJsonArray(brief.actionCenter),
      warnings: parseJsonArray(brief.warnings),
      createdAt: brief.createdAt.toISOString(),
    })),
    reportSummary: report
      ? {
          generatedAt: report.generatedAt,
          profileSummary: report.profileSummary,
          careerHealth: report.careerHealth,
          jobsSummary: {
            savedJobsCount: report.jobsSummary.savedJobsCount,
            averageMatchScore: report.jobsSummary.averageMatchScore,
            bestMatchScore: report.jobsSummary.bestMatchScore,
          },
          warnings: report.warnings,
        }
      : null,
    resumeImprovementCenter: report?.resumeImprovementCenter ?? null,
    skillsPriorityPlan: report?.skillsPriorityPlan ?? [],
    careerExecutionPlan: report?.careerExecutionPlan ?? null,
    dataSources: report?.freshness ?? null,
  };
}
