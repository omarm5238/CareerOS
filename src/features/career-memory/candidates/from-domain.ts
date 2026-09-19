import { prisma } from "@/server/db/prisma";

import { displayName, entityCanonical, slugCanonical } from "../lib/canonical";
import { evidenceFingerprint, semanticMemoryKey } from "../lib/fingerprint";
import { asStringArray } from "../lib/json";
import { looksSensitive, sanitizeEvidence, sanitizeNormalizedText } from "../sanitization/sanitize";
import type {
  CareerMemoryPreferenceView,
  MemoryCandidate,
  MemoryEvidenceDraft,
} from "../types";

function draft(input: Omit<MemoryCandidate, "evidence"> & { evidence: MemoryEvidenceDraft[] }): MemoryCandidate | null {
  try {
    const normalizedText = sanitizeNormalizedText(input.normalizedText);
    const evidence = input.evidence
      .map((item) => {
        const cleaned = sanitizeEvidence(item.evidence);
        if (!cleaned) return null;
        return { ...item, evidence: cleaned };
      })
      .filter((item): item is MemoryEvidenceDraft => item !== null);
    if (evidence.length === 0) return null;
    return { ...input, normalizedText, evidence };
  } catch {
    return null;
  }
}

function ev(parts: {
  sourceSubsystem: MemoryEvidenceDraft["sourceSubsystem"];
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  sourceEventId?: string | null;
  observedAt: Date;
  evidenceType: MemoryEvidenceDraft["evidenceType"];
  evidence: Record<string, unknown>;
  weight: number;
  semantic: string;
}): MemoryEvidenceDraft {
  return {
    sourceSubsystem: parts.sourceSubsystem,
    sourceEntityType: parts.sourceEntityType ?? null,
    sourceEntityId: parts.sourceEntityId ?? null,
    sourceEventId: parts.sourceEventId ?? null,
    observedAt: parts.observedAt,
    evidenceType: parts.evidenceType,
    evidence: parts.evidence,
    weight: parts.weight,
    fingerprint: evidenceFingerprint({
      sourceSubsystem: parts.sourceSubsystem,
      sourceEntityType: parts.sourceEntityType,
      sourceEntityId: parts.sourceEntityId,
      sourceEventId: parts.sourceEventId,
      semantic: parts.semantic,
    }),
  };
}

export async function collectMemoryCandidates(input: {
  userId: string;
  since: Date;
  now: Date;
  preferences: CareerMemoryPreferenceView;
}): Promise<MemoryCandidate[]> {
  const { userId, since, now, preferences } = input;
  const candidates: MemoryCandidate[] = [];

  const [
    profile,
    resumeVersions,
    requirements,
    events,
    drafts,
    posts,
    plans,
    pillars,
    deferredActions,
    completedActions,
    reviews,
  ] = await Promise.all([
    prisma.jobDiscoveryProfile.findUnique({ where: { userId } }),
    prisma.resumeVersion.findMany({
      where: { userId, status: { in: ["READY", "USED"] }, updatedAt: { gte: since } },
      select: { id: true, title: true, updatedAt: true, status: true, activeRevisionId: true },
      take: 40,
    }),
    prisma.jobRequirement.findMany({
      where: { userId, category: "SKILL", createdAt: { gte: since } },
      include: { evidenceMatches: true, jobPosting: { select: { id: true, title: true } } },
      take: 200,
    }),
    prisma.applicationEvent.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        toStatus: { in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "ACCEPTED"] },
      },
      select: { id: true, toStatus: true, createdAt: true, applicationId: true },
      take: 80,
    }),
    prisma.communicationDraft.findMany({
      where: { userId, usedAt: { gte: since }, status: "USED" },
      select: { id: true, type: true, usedAt: true },
      take: 80,
    }),
    prisma.linkedinPost.findMany({
      where: { userId, status: "PUBLISHED", updatedAt: { gte: since } },
      select: { id: true, status: true, publishedAt: true, createdAt: true, updatedAt: true },
      take: 40,
    }),
    prisma.linkedinPublishingPlan.findMany({
      where: { userId, status: "PUBLISHED", publishedAt: { gte: since } },
      select: { id: true, status: true, createdAt: true, publishedAt: true, linkedinPostId: true },
      take: 40,
    }),
    prisma.linkedinContentPillar.findMany({
      where: { userId },
      select: { id: true, name: true, updatedAt: true },
      take: 12,
    }),
    prisma.dailyRoadmapAction.findMany({
      where: { userId, status: "DEFERRED", updatedAt: { gte: since } },
      select: { id: true, fingerprint: true, type: true, estimatedMinutes: true, updatedAt: true, title: true },
      take: 120,
    }),
    prisma.dailyRoadmapAction.findMany({
      where: { userId, status: "COMPLETED", isMeaningful: true, completedAt: { gte: since } },
      select: { id: true, fingerprint: true, type: true, estimatedMinutes: true, completedAt: true, title: true },
      take: 120,
    }),
    prisma.weeklyCareerReview.findMany({
      where: { userId, status: "FINALIZED", finalizedAt: { gte: since } },
      include: { insights: true },
      orderBy: { weekStartLocalDate: "desc" },
      take: 12,
    }),
  ]);

  const push = (candidate: MemoryCandidate | null) => {
    if (candidate) candidates.push(candidate);
  };

  if (profile && preferences.allowLongTermPreferences) {
    for (const role of asStringArray(profile.roleTargetsJson).slice(0, 5)) {
      if (looksSensitive(role)) continue;
      const key = slugCanonical(role);
      const semantic = semanticMemoryKey({
        type: "FOCUS",
        category: "CAREER_TARGET",
        subjectKey: "focus.primary",
        normalizedValueKey: key,
      });
      push(
        draft({
          type: "FOCUS",
          category: "CAREER_TARGET",
          subjectKey: "focus.primary",
          normalizedValueKey: key,
          value: { role },
          normalizedText: displayName(role),
          sourceType: "M23_JOBS",
          importance: "HIGH",
          validityClass: "FOCUS",
          sensitivityClass: "SAFE",
          graphSuggestions: [
            {
              entityType: "ROLE",
              canonicalKey: entityCanonical("role", role),
              displayName: displayName(role),
              relationType: "TARGETS_ROLE",
            },
          ],
          evidence: [
            ev({
              sourceSubsystem: "M23_JOBS",
              sourceEntityType: "jobDiscoveryProfile",
              sourceEntityId: profile.id,
              sourceEventId: `profile-role:${profile.id}:${key}`,
              observedAt: profile.updatedAt,
              evidenceType: "DOMAIN_EVENT",
              evidence: { summary: `Explicit job-search role target: ${displayName(role)}` },
              weight: 90,
              semantic,
            }),
          ],
        }),
      );
    }
    for (const location of asStringArray(profile.locationTargetsJson).slice(0, 5)) {
      const key = slugCanonical(location);
      const semantic = semanticMemoryKey({
        type: "PREFERENCE",
        category: "PREFERENCE",
        subjectKey: "pref.location",
        normalizedValueKey: key,
      });
      push(
        draft({
          type: "PREFERENCE",
          category: "PREFERENCE",
          subjectKey: "pref.location",
          normalizedValueKey: key,
          value: { location },
          normalizedText: displayName(location),
          sourceType: "M23_JOBS",
          importance: "MEDIUM",
          validityClass: "PERSISTENT",
          sensitivityClass: "SAFE",
          graphSuggestions: [
            {
              entityType: "LOCATION",
              canonicalKey: entityCanonical("location", location),
              displayName: displayName(location),
              relationType: "PREFERS_LOCATION",
            },
          ],
          evidence: [
            ev({
              sourceSubsystem: "M23_JOBS",
              sourceEntityType: "jobDiscoveryProfile",
              sourceEntityId: profile.id,
              sourceEventId: `profile-location:${profile.id}:${key}`,
              observedAt: profile.updatedAt,
              evidenceType: "DOMAIN_EVENT",
              evidence: { summary: `Explicit location target: ${displayName(location)}` },
              weight: 90,
              semantic,
            }),
          ],
        }),
      );
    }
    for (const mode of asStringArray(profile.workModesJson).slice(0, 4)) {
      const key = slugCanonical(mode);
      const semantic = semanticMemoryKey({
        type: "PREFERENCE",
        category: "PREFERENCE",
        subjectKey: "pref.work-style",
        normalizedValueKey: key,
      });
      push(
        draft({
          type: "PREFERENCE",
          category: "PREFERENCE",
          subjectKey: "pref.work-style",
          normalizedValueKey: key,
          value: { workStyle: mode },
          normalizedText: displayName(mode),
          sourceType: "M23_JOBS",
          importance: "MEDIUM",
          validityClass: "PERSISTENT",
          sensitivityClass: "SAFE",
          graphSuggestions: [
            {
              entityType: "WORK_STYLE",
              canonicalKey: entityCanonical("work-style", mode),
              displayName: displayName(mode),
              relationType: "PREFERS_WORK_STYLE",
            },
          ],
          evidence: [
            ev({
              sourceSubsystem: "M23_JOBS",
              sourceEntityType: "jobDiscoveryProfile",
              sourceEntityId: profile.id,
              sourceEventId: `profile-mode:${profile.id}:${key}`,
              observedAt: profile.updatedAt,
              evidenceType: "DOMAIN_EVENT",
              evidence: { summary: `Explicit work-style target: ${displayName(mode)}` },
              weight: 90,
              semantic,
            }),
          ],
        }),
      );
    }
  }

  for (const version of resumeVersions) {
    if (looksSensitive(version.title)) continue;
    const key = slugCanonical(version.title);
    const semantic = semanticMemoryKey({
      type: "SKILL_SIGNAL",
      category: "ROLE",
      subjectKey: "resume.focus",
      normalizedValueKey: key,
    });
    const revisionId = version.activeRevisionId ?? "none";
    push(
      draft({
        type: "SKILL_SIGNAL",
        category: "ROLE",
        subjectKey: "resume.focus",
        normalizedValueKey: key,
        value: { title: version.title, status: version.status, revisionId },
        normalizedText: displayName(version.title),
        sourceType: "M21_RESUME",
        importance: "MEDIUM",
        validityClass: "SKILL",
        sensitivityClass: "SAFE",
        graphSuggestions: [
          {
            entityType: "RESUME",
            canonicalKey: entityCanonical("resume", version.id),
            displayName: displayName(version.title),
            relationType: "RELATED_TO",
          },
        ],
        evidence: [
          ev({
            sourceSubsystem: "M21_RESUME",
            sourceEntityType: "resumeVersionRevision",
            sourceEntityId: revisionId,
            sourceEventId: `READY:${version.id}:${revisionId}`,
            observedAt: version.updatedAt,
            evidenceType: "DOMAIN_EVENT",
            evidence: { summary: `Resume marked READY: ${displayName(version.title)}`, status: version.status },
            weight: 90,
            semantic,
          }),
        ],
      }),
    );
  }

  const gapBySkill = new Map<string, { name: string; jobs: Set<string>; evidence: MemoryEvidenceDraft[] }>();
  const hasBySkill = new Map<string, { name: string; jobs: Set<string>; evidence: MemoryEvidenceDraft[] }>();
  for (const requirement of requirements) {
    const name = requirement.normalizedName;
    if (!name || looksSensitive(name)) continue;
    const key = slugCanonical(name);
    const weak = requirement.evidenceMatches.some((match) => match.matchStrength === "NONE" || match.matchStrength === "PARTIAL");
    const strong = requirement.evidenceMatches.some((match) => match.matchStrength === "DIRECT" || match.matchStrength === "STRONG");
    const semanticGap = semanticMemoryKey({
      type: "EVIDENCE_SIGNAL",
      category: "EVIDENCE",
      subjectKey: "skill.gap",
      normalizedValueKey: key,
    });
    const semanticHas = semanticMemoryKey({
      type: "SKILL_SIGNAL",
      category: "SKILL",
      subjectKey: "skill.has",
      normalizedValueKey: key,
    });
    if (weak) {
      const bucket = gapBySkill.get(key) ?? { name, jobs: new Set<string>(), evidence: [] };
      bucket.jobs.add(requirement.jobPostingId);
      bucket.evidence.push(
        ev({
          sourceSubsystem: "M23_JOBS",
          sourceEntityType: "jobRequirement",
          sourceEntityId: requirement.id,
          sourceEventId: requirement.id,
          observedAt: requirement.createdAt,
          evidenceType: "DOMAIN_EVENT",
          evidence: { summary: `Evidence gap for ${displayName(name)}`, jobId: requirement.jobPostingId },
          weight: 75,
          semantic: semanticGap,
        }),
      );
      gapBySkill.set(key, bucket);
    }
    if (strong) {
      const bucket = hasBySkill.get(key) ?? { name, jobs: new Set<string>(), evidence: [] };
      bucket.jobs.add(requirement.jobPostingId);
      bucket.evidence.push(
        ev({
          sourceSubsystem: "M23_JOBS",
          sourceEntityType: "jobRequirement",
          sourceEntityId: requirement.id,
          sourceEventId: `has:${requirement.id}`,
          observedAt: requirement.createdAt,
          evidenceType: "DOMAIN_EVENT",
          evidence: { summary: `Evidence supports ${displayName(name)}` },
          weight: 80,
          semantic: semanticHas,
        }),
      );
      hasBySkill.set(key, bucket);
    }
  }
  for (const [key, bucket] of gapBySkill) {
    if (bucket.jobs.size < 3) continue;
    push(
      draft({
        type: "EVIDENCE_SIGNAL",
        category: "EVIDENCE",
        subjectKey: "skill.gap",
        normalizedValueKey: key,
        value: { skill: bucket.name, jobCount: bucket.jobs.size },
        normalizedText: displayName(bucket.name),
        sourceType: "M23_JOBS",
        importance: "HIGH",
        validityClass: "EVIDENCE",
        sensitivityClass: "SAFE",
        graphSuggestions: [
          {
            entityType: "SKILL",
            canonicalKey: entityCanonical("skill", bucket.name),
            displayName: displayName(bucket.name),
            relationType: "LACKS_EVIDENCE_FOR",
          },
        ],
        evidence: bucket.evidence,
      }),
    );
  }
  for (const [key, bucket] of hasBySkill) {
    if (bucket.jobs.size < 2) continue;
    push(
      draft({
        type: "SKILL_SIGNAL",
        category: "SKILL",
        subjectKey: "skill.has",
        normalizedValueKey: key,
        value: { skill: bucket.name, jobCount: bucket.jobs.size },
        normalizedText: displayName(bucket.name),
        sourceType: "M23_JOBS",
        importance: "MEDIUM",
        validityClass: "SKILL",
        sensitivityClass: "SAFE",
        graphSuggestions: [
          {
            entityType: "SKILL",
            canonicalKey: entityCanonical("skill", bucket.name),
            displayName: displayName(bucket.name),
            relationType: "HAS_EVIDENCE_FOR",
          },
        ],
        evidence: bucket.evidence,
      }),
    );
  }

  const interviews = events.filter((item) => item.toStatus === "INTERVIEW");
  if (interviews[0]) {
    const semantic = semanticMemoryKey({
      type: "MILESTONE",
      category: "APPLICATION",
      subjectKey: "milestone.interview",
      normalizedValueKey: "first",
    });
    push(
      draft({
        type: "MILESTONE",
        category: "APPLICATION",
        subjectKey: "milestone.interview",
        normalizedValueKey: "first",
        value: { count: interviews.length },
        normalizedText: "First interview",
        sourceType: "M22_APPLICATION",
        importance: "HIGH",
        validityClass: "MILESTONE",
        sensitivityClass: "SAFE",
        graphSuggestions: [
          {
            entityType: "APPLICATION",
            canonicalKey: entityCanonical("application", interviews[0].applicationId),
            displayName: "Interview",
            relationType: "INTERVIEWED_WITH",
          },
        ],
        evidence: [
          ev({
            sourceSubsystem: "M22_APPLICATION",
            sourceEntityType: "applicationEvent",
            sourceEntityId: interviews[0].id,
            sourceEventId: interviews[0].id,
            observedAt: interviews[0].createdAt,
            evidenceType: "DOMAIN_EVENT",
            evidence: { summary: "Interview stage reached" },
            weight: 90,
            semantic,
          }),
        ],
      }),
    );
  }
  const offers = events.filter((item) => item.toStatus === "OFFER" || item.toStatus === "ACCEPTED");
  if (offers[0]) {
    const semantic = semanticMemoryKey({
      type: "MILESTONE",
      category: "ACHIEVEMENT",
      subjectKey: "milestone.offer",
      normalizedValueKey: "first",
    });
    push(
      draft({
        type: "MILESTONE",
        category: "ACHIEVEMENT",
        subjectKey: "milestone.offer",
        normalizedValueKey: "first",
        value: { count: offers.length },
        normalizedText: "First offer",
        sourceType: "M22_APPLICATION",
        importance: "HIGH",
        validityClass: "MILESTONE",
        sensitivityClass: "SAFE",
        graphSuggestions: [],
        evidence: [
          ev({
            sourceSubsystem: "M22_APPLICATION",
            sourceEntityType: "applicationEvent",
            sourceEntityId: offers[0].id,
            sourceEventId: offers[0].id,
            observedAt: offers[0].createdAt,
            evidenceType: "DOMAIN_EVENT",
            evidence: { summary: "Offer stage reached" },
            weight: 90,
            semantic,
          }),
        ],
      }),
    );
  }

  if (preferences.allowBehavioralMemory) {
    const followUps = drafts.filter((item) => item.type === "FOLLOW_UP" || item.type === "INTERVIEW_THANK_YOU");
    const weeks = new Set(followUps.map((item) => item.usedAt?.toISOString().slice(0, 10).slice(0, 7)));
    if (followUps.length >= 3 && weeks.size >= 2) {
      const semantic = semanticMemoryKey({
        type: "BEHAVIOR_PATTERN",
        category: "COMMUNICATION",
        subjectKey: "pattern.follow-up",
        normalizedValueKey: "used",
      });
      push(
        draft({
          type: "BEHAVIOR_PATTERN",
          category: "COMMUNICATION",
          subjectKey: "pattern.follow-up",
          normalizedValueKey: "used",
          value: { used: followUps.length },
          normalizedText: "Follow-up communications are used repeatedly",
          sourceType: "M24_COMMUNICATION",
          importance: "MEDIUM",
          validityClass: "BEHAVIOR",
          sensitivityClass: "SAFE",
          graphSuggestions: [],
          evidence: followUps.slice(0, 6).map((item) =>
            ev({
              sourceSubsystem: "M24_COMMUNICATION",
              sourceEntityType: "communicationDraft",
              sourceEntityId: item.id,
              sourceEventId: item.id,
              observedAt: item.usedAt ?? now,
              evidenceType: "DAILY_PATTERN",
              evidence: { summary: "Follow-up communication marked USED", type: item.type },
              weight: 65,
              semantic,
            }),
          ),
        }),
      );
    }
  }

  const publishedPlans = plans.filter((item) => item.status === "PUBLISHED");
  const publishedPosts = posts.filter((item) => item.status === "PUBLISHED" || item.publishedAt);
  const firstPlan = publishedPlans[0];
  const firstPost = publishedPosts[0];
  if (firstPlan || firstPost) {
    const postId = firstPlan?.linkedinPostId ?? firstPost?.id;
    const planId = firstPlan?.id ?? null;
    const semantic = semanticMemoryKey({
      type: "MILESTONE",
      category: "LINKEDIN",
      subjectKey: "milestone.linkedin-publish",
      normalizedValueKey: "first",
    });
    push(
      draft({
        type: "MILESTONE",
        category: "LINKEDIN",
        subjectKey: "milestone.linkedin-publish",
        normalizedValueKey: "first",
        value: { count: publishedPlans.length || publishedPosts.length, postId, planId },
        normalizedText: "First published LinkedIn post",
        sourceType: "M25_LINKEDIN",
        importance: "MEDIUM",
        validityClass: "MILESTONE",
        sensitivityClass: "SAFE",
        graphSuggestions: [
          {
            entityType: "LINKEDIN_POST",
            canonicalKey: entityCanonical("linkedin-post", postId ?? "post"),
            displayName: "LinkedIn post",
            relationType: "PUBLISHED_ABOUT",
          },
        ],
        evidence: [
          ev({
            sourceSubsystem: "M25_LINKEDIN",
            sourceEntityType: planId ? "linkedinPublishingPlan" : "linkedinPost",
            sourceEntityId: planId ?? postId,
            sourceEventId: planId && postId ? `${postId}:${planId}` : postId ?? planId,
            observedAt: firstPlan?.publishedAt ?? firstPost?.publishedAt ?? firstPost?.updatedAt ?? now,
            evidenceType: "DOMAIN_EVENT",
            evidence: { summary: "LinkedIn post published", publishingSource: "normalized" },
            weight: 90,
            semantic,
          }),
        ],
      }),
    );
  }
  if (preferences.allowLongTermPreferences) {
    for (const pillar of pillars.slice(0, 4)) {
      const key = slugCanonical(pillar.name);
      const semantic = semanticMemoryKey({
        type: "FOCUS",
        category: "LINKEDIN",
        subjectKey: "linkedin.pillar",
        normalizedValueKey: key,
      });
      push(
        draft({
          type: "FOCUS",
          category: "LINKEDIN",
          subjectKey: "linkedin.pillar",
          normalizedValueKey: key,
          value: { pillar: pillar.name },
          normalizedText: displayName(pillar.name),
          sourceType: "M25_LINKEDIN",
          importance: "MEDIUM",
          validityClass: "FOCUS",
          sensitivityClass: "SAFE",
          graphSuggestions: [
            {
              entityType: "CAREER_GOAL",
              canonicalKey: entityCanonical("goal", pillar.name),
              displayName: displayName(pillar.name),
              relationType: "FOCUSES_ON",
            },
          ],
          evidence: [
            ev({
              sourceSubsystem: "M25_LINKEDIN",
              sourceEntityType: "linkedinContentPillar",
              sourceEntityId: pillar.id,
              sourceEventId: pillar.id,
              observedAt: pillar.updatedAt,
              evidenceType: "DOMAIN_EVENT",
              evidence: { summary: `Stable LinkedIn pillar: ${displayName(pillar.name)}` },
              weight: 75,
              semantic,
            }),
          ],
        }),
      );
    }
  }

  if (preferences.allowBehavioralMemory && preferences.allowDerivedPatterns) {
    const byFingerprint = new Map<string, typeof deferredActions>();
    for (const action of deferredActions) {
      const list = byFingerprint.get(action.fingerprint) ?? [];
      list.push(action);
      byFingerprint.set(action.fingerprint, list);
    }
    for (const [, rows] of byFingerprint) {
      const weeks = new Set(rows.map((item) => item.updatedAt.toISOString().slice(0, 10)));
      if (rows.length < 3 || weeks.size < 2) continue;
      const sample = rows[0];
      const key = slugCanonical(sample.fingerprint);
      const semantic = semanticMemoryKey({
        type: "BEHAVIOR_PATTERN",
        category: "EXECUTION",
        subjectKey: "pattern.defer",
        normalizedValueKey: key,
      });
      push(
        draft({
          type: "BEHAVIOR_PATTERN",
          category: "EXECUTION",
          subjectKey: "pattern.defer",
          normalizedValueKey: key,
          value: { type: sample.type, estimatedMinutes: sample.estimatedMinutes, count: rows.length },
          normalizedText: `Repeated deferral of ${sample.type.replaceAll("_", " ").toLowerCase()}`,
          sourceType: "M26_DAILY",
          importance: "MEDIUM",
          validityClass: "BEHAVIOR",
          sensitivityClass: "SAFE",
          graphSuggestions: [],
          evidence: rows.slice(0, 6).map((item) =>
            ev({
              sourceSubsystem: "M26_DAILY",
              sourceEntityType: "dailyRoadmapAction",
              sourceEntityId: item.id,
              sourceEventId: item.id,
              observedAt: item.updatedAt,
              evidenceType: "DAILY_PATTERN",
              evidence: { summary: "Same career action deferred again", type: item.type },
              weight: 65,
              semantic,
            }),
          ),
        }),
      );
    }
  }

  if (preferences.allowBehavioralMemory && preferences.allowDerivedPatterns) {
    const byFingerprint = new Map<string, typeof completedActions>();
    for (const action of completedActions) {
      const list = byFingerprint.get(action.fingerprint) ?? [];
      list.push(action);
      byFingerprint.set(action.fingerprint, list);
    }
    for (const [, rows] of byFingerprint) {
      const weeks = new Set(rows.map((item) => (item.completedAt ?? now).toISOString().slice(0, 10)));
      if (rows.length < 3 || weeks.size < 2) continue;
      const sample = rows[0];
      const key = slugCanonical(sample.fingerprint);
      const semantic = semanticMemoryKey({
        type: "BEHAVIOR_PATTERN",
        category: "EXECUTION",
        subjectKey: "pattern.complete",
        normalizedValueKey: key,
      });
      push(
        draft({
          type: "BEHAVIOR_PATTERN",
          category: "EXECUTION",
          subjectKey: "pattern.complete",
          normalizedValueKey: key,
          value: { type: sample.type, estimatedMinutes: sample.estimatedMinutes, count: rows.length },
          normalizedText: `Repeated completion of ${sample.type.replaceAll("_", " ").toLowerCase()}`,
          sourceType: "M26_DAILY",
          importance: "MEDIUM",
          validityClass: "BEHAVIOR",
          sensitivityClass: "SAFE",
          graphSuggestions: [],
          evidence: rows.slice(0, 6).map((item) =>
            ev({
              sourceSubsystem: "M26_DAILY",
              sourceEntityType: "dailyRoadmapAction",
              sourceEntityId: item.id,
              sourceEventId: `COMPLETED:${item.id}`,
              observedAt: item.completedAt ?? now,
              evidenceType: "DAILY_PATTERN",
              evidence: { summary: "Meaningful career action completed", type: item.type },
              weight: 65,
              semantic,
            }),
          ),
        }),
      );
    }
  }

  if (preferences.allowDerivedPatterns) {
    const insightCounts = new Map<string, { count: number; evidence: MemoryEvidenceDraft[]; text: string }>();
    for (const review of reviews) {
      for (const insight of review.insights) {
        if (!["EVIDENCE_GAP", "FOLLOW_UP_GAP", "CONSISTENCY_PATTERN", "STALL_PATTERN"].includes(insight.type)) continue;
        const key = insight.type.toLowerCase();
        const semantic = semanticMemoryKey({
          type: "CAREER_PATTERN",
          category: insight.category === "SKILLS_EVIDENCE" ? "EVIDENCE" : "EXECUTION",
          subjectKey: `weekly.${key}`,
          normalizedValueKey: key,
        });
        const bucket = insightCounts.get(key) ?? { count: 0, evidence: [], text: insight.title };
        bucket.count += 1;
        bucket.evidence.push(
          ev({
            sourceSubsystem: "M27_WEEKLY",
            sourceEntityType: "weeklyCareerInsight",
            sourceEntityId: insight.id,
            sourceEventId: `${review.id}:${insight.fingerprint}`,
            observedAt: review.finalizedAt ?? review.updatedAt,
            evidenceType: "WEEKLY_PATTERN",
            evidence: { summary: insight.title, week: review.weekStartLocalDate, type: insight.type },
            weight: 75,
            semantic,
          }),
        );
        insightCounts.set(key, bucket);
      }
    }
    for (const [key, bucket] of insightCounts) {
      if (bucket.count < 2) continue;
      push(
        draft({
          type: "CAREER_PATTERN",
          category: key === "evidence_gap" ? "EVIDENCE" : "EXECUTION",
          subjectKey: `weekly.${key}`,
          normalizedValueKey: key,
          value: { repeats: bucket.count },
          normalizedText: bucket.text,
          sourceType: "M27_WEEKLY",
          importance: bucket.count >= 3 ? "HIGH" : "MEDIUM",
          validityClass: "PATTERN",
          sensitivityClass: "SAFE",
          graphSuggestions: [],
          evidence: bucket.evidence,
        }),
      );
    }
    if (reviews[0]) {
      const semantic = semanticMemoryKey({
        type: "MILESTONE",
        category: "ACHIEVEMENT",
        subjectKey: "milestone.weekly-review",
        normalizedValueKey: "first",
      });
      push(
        draft({
          type: "MILESTONE",
          category: "ACHIEVEMENT",
          subjectKey: "milestone.weekly-review",
          normalizedValueKey: "first",
          value: { count: reviews.length },
          normalizedText: "First finalized weekly review",
          sourceType: "M27_WEEKLY",
          importance: "LOW",
          validityClass: "MILESTONE",
          sensitivityClass: "SAFE",
          graphSuggestions: [],
          evidence: [
            ev({
              sourceSubsystem: "M27_WEEKLY",
              sourceEntityType: "weeklyCareerReview",
              sourceEntityId: reviews[reviews.length - 1]?.id,
              sourceEventId: reviews[reviews.length - 1]?.id,
              observedAt: reviews[reviews.length - 1]?.finalizedAt ?? now,
              evidenceType: "DOMAIN_EVENT",
              evidence: { summary: "Weekly review finalized" },
              weight: 90,
              semantic,
            }),
          ],
        }),
      );
    }
  }

  return candidates;
}
