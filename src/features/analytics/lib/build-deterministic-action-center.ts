import {
  canonicalActionTitleKey,
  canonicalizeActionTitle,
  classifyInsightItem,
  classifyRequirement,
  estimateLearningEffort,
  filterSkillLikeItems,
  isResumeImprovementPhrase,
} from "@/features/shared/insights";
import {
  shortJobDisplayTitle,
  skillFamilyKeyForDedupe,
} from "@/features/skills/lib/build-selected-job-project-ideas";

import type { CareerBriefActionCenterSection, CareerBriefActionSection } from "../ai/types";
import type { AnalyticsModuleData } from "../types";

const SECTIONS_ORDER: CareerBriefActionSection[] = [
  "Job Actions",
  "Resume Fixes",
  "Portfolio Proof",
  "Interview Prep",
];

const MAX_ACTIONS = 5;
const MAX_RESUME_ACTIONS = 2;
const PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 } as const;

const JOB_ACTION_HINT =
  /\b(save(d)? (one |a |1[–-]?\d?\s*)?(target )?jobs?|add (saved |target )?jobs?|benchmark|job description|collect .*jobs?|analyze job match|compare .*requirements)\b/i;

function isJobActionTitle(title: string): boolean {
  return JOB_ACTION_HINT.test(title) || classifyInsightItem(title) === "job_follow_up";
}

function isInterviewTitle(title: string): boolean {
  return /\b(interview|star stor|mock interview|behavioral)\b/i.test(title);
}

function isPortfolioTitle(title: string): boolean {
  return /\b(portfolio|github|deploy|readme proof|link (the )?repo)\b/i.test(title);
}

function isSkillProofTitle(title: string): boolean {
  return (
    /\b(proof|build|project|learn|practice)\b/i.test(title) &&
    !isResumeImprovementPhrase(title) &&
    !isJobActionTitle(title)
  );
}

function remappedSectionForTitle(
  title: string,
  preferred: CareerBriefActionSection,
): CareerBriefActionSection {
  if (isInterviewTitle(title)) return "Interview Prep";
  if (isPortfolioTitle(title) && preferred !== "Skill Proof Needed") return "Portfolio Proof";
  if (isJobActionTitle(title)) return "Job Actions";
  if (preferred === "Resume Fixes" && !isResumeImprovementPhrase(title) && isJobActionTitle(title)) {
    return "Job Actions";
  }
  if (preferred === "Resume Fixes" && isSkillProofTitle(title)) return "Portfolio Proof";
  if (preferred === "Skill Proof Needed") return "Portfolio Proof";
  return preferred;
}

function skillProofFamilyKey(title: string): string | null {
  const match = title.match(
    /\b(?:build proof for|address missing skill:|missing skill:)\s+(.+?)(?:\s+for\s+.+)?$/i,
  );
  if (!match?.[1]) return null;
  return `skill-proof:${skillFamilyKeyForDedupe(match[1])}`;
}

function pushItem(
  buckets: Map<CareerBriefActionSection, CareerBriefActionCenterSection["items"]>,
  section: CareerBriefActionSection,
  item: CareerBriefActionCenterSection["items"][number],
) {
  const target = remappedSectionForTitle(item.title, section);
  const list = buckets.get(target) ?? [];
  const normalizedItem = {
    ...item,
    title: canonicalizeActionTitle(item.title),
  };
  const key = canonicalActionTitleKey(normalizedItem.title);
  const skillKey = skillProofFamilyKey(normalizedItem.title);
  if (list.some((existing) => canonicalActionTitleKey(existing.title) === key)) return;
  if (
    skillKey &&
    list.some((existing) => skillProofFamilyKey(existing.title) === skillKey)
  ) {
    return;
  }
  if (list.length >= 5) return;
  list.push(normalizedItem);
  buckets.set(target, list);
}

function ladderRank(section: CareerBriefActionSection, title: string): number {
  if (section === "Job Actions" && /\bimprove match for\b/i.test(title)) return 0;
  if (section === "Job Actions" && /\bsave one target job\b/i.test(title)) return 0;
  if (section === "Resume Fixes") return 1;
  if (section === "Portfolio Proof" && /\b(missing skill|build proof for)\b/i.test(title)) {
    return 2;
  }
  if (section === "Portfolio Proof") return 3;
  if (section === "Job Actions") return 4;
  if (section === "Interview Prep") return 5;
  return 6;
}

function finalizeBuckets(
  buckets: Map<CareerBriefActionSection, CareerBriefActionCenterSection["items"]>,
): CareerBriefActionCenterSection[] {
  const seen = new Set<string>();
  const seenSkillFamilies = new Set<string>();
  const selected: Array<{
    section: CareerBriefActionSection;
    item: CareerBriefActionCenterSection["items"][number];
  }> = [];
  let resumeCount = 0;

  const candidates = SECTIONS_ORDER.flatMap((section) =>
    (buckets.get(section) ?? []).map((item) => ({ section, item })),
  ).sort(
    (a, b) =>
      ladderRank(a.section, a.item.title) - ladderRank(b.section, b.item.title) ||
      PRIORITY_WEIGHT[a.item.priority] - PRIORITY_WEIGHT[b.item.priority] ||
      SECTIONS_ORDER.indexOf(a.section) - SECTIONS_ORDER.indexOf(b.section),
  );

  for (const candidate of candidates) {
    const key = canonicalActionTitleKey(candidate.item.title);
    if (seen.has(key)) continue;
    const skillKey = skillProofFamilyKey(candidate.item.title);
    if (skillKey && seenSkillFamilies.has(skillKey)) continue;
    if (candidate.section === "Resume Fixes" && resumeCount >= MAX_RESUME_ACTIONS) continue;
    seen.add(key);
    if (skillKey) seenSkillFamilies.add(skillKey);
    selected.push(candidate);
    if (candidate.section === "Resume Fixes") resumeCount += 1;
    if (selected.length >= MAX_ACTIONS) break;
  }

  return SECTIONS_ORDER.flatMap((section) => {
    const items = selected
      .filter((candidate) => candidate.section === section)
      .map((candidate) => candidate.item);
    return items.length > 0 ? [{ section, items }] : [];
  });
}

export function buildDeterministicActionCenter(
  data: AnalyticsModuleData,
): CareerBriefActionCenterSection[] {
  const buckets = new Map<CareerBriefActionSection, CareerBriefActionCenterSection["items"]>();
  const marketSkills = filterSkillLikeItems(data.skills.topPrioritySkills).filter(
    (item) => classifyRequirement(item).kind === "skill",
  );
  const selectedJob =
    data.scopeMode === "selected_job" ? data.targetJobContext.selectedJob : null;
  const shortSelected = selectedJob
    ? shortJobDisplayTitle(selectedJob.title) ?? selectedJob.title
    : null;

  if (!data.resume.hasResume) {
    pushItem(buckets, "Resume Fixes", {
      title: "Upload and analyze a resume",
      reason: "Resume analysis unlocks matching, skills, and readiness scoring.",
      priority: "High",
    });
  } else if ((data.resume.completenessScore ?? 0) < 70) {
    pushItem(buckets, "Resume Fixes", {
      title: "Improve resume completeness",
      reason: `Completeness is ${data.resume.completenessScore}%.`,
      priority: "High",
    });
  }

  if (data.jobs.savedJobsCount === 0) {
    pushItem(buckets, "Job Actions", {
      title: "Save one target job",
      reason: "Saved jobs create match and skill-gap signals.",
      priority: "High",
    });
  }

  if (selectedJob) {
    const matchScore = selectedJob.analysis?.matchScore;
    pushItem(buckets, "Job Actions", {
      title: `Improve match for ${shortSelected}`,
      reason:
        matchScore === undefined
          ? `Analyze the selected target job at ${selectedJob.company}.`
          : `Selected-job match is ${matchScore}%. Address its strongest blocker first.`,
      priority: "High",
    });
    pushItem(buckets, "Resume Fixes", {
      title: "Improve resume evidence for selected target job",
      reason: `Tailor proof to ${selectedJob.company} without adding unsupported claims.`,
      priority: "High",
    });
  }

  if (marketSkills[0]) {
    pushItem(buckets, "Portfolio Proof", {
      title: `Build proof for ${marketSkills[0]}`,
      reason: selectedJob
        ? `Highest technical gap for the selected target job at ${selectedJob.company}.`
        : "Top repeated technical gap across saved jobs.",
      priority: "High",
    });
  } else if (data.jobs.savedJobsCount > 0 && data.skills.gapsCount > 0) {
    pushItem(buckets, "Portfolio Proof", {
      title: "Review skill gaps against saved jobs",
      reason: `${data.skills.gapsCount} gap(s) detected from job analyses.`,
      priority: "Medium",
    });
  } else if (data.jobs.savedJobsCount === 0 && data.resume.hasResume) {
    pushItem(buckets, "Resume Fixes", {
      title: "Polish one resume section with measurable proof",
      reason: "Strengthen the resume while you collect target jobs.",
      priority: "Medium",
    });
  }

  if (
    !selectedJob &&
    (data.jobs.averageMatchScore ?? 100) < 60 &&
    data.jobs.savedJobsCount > 0
  ) {
    pushItem(buckets, "Job Actions", {
      title: "Raise match quality before applying",
      reason: `Average match is ${data.jobs.averageMatchScore}% across saved jobs.`,
      priority: "High",
    });
  }

  const resumeOnlyTips = data.recommendations
    .filter((tip) => isResumeImprovementPhrase(tip) || classifyInsightItem(tip) === "resume_fix")
    .filter((tip) => !isJobActionTitle(tip))
    .slice(0, 3);

  for (const tip of resumeOnlyTips) {
    pushItem(buckets, "Resume Fixes", {
      title: tip.slice(0, 120),
      reason: "Direct resume content or structure fix.",
      priority: "Medium",
    });
  }

  if (marketSkills.length > 0) {
    for (const skill of marketSkills.slice(0, 3)) {
      if (
        marketSkills[0] &&
        skillFamilyKeyForDedupe(skill) === skillFamilyKeyForDedupe(marketSkills[0])
      ) {
        continue;
      }
      pushItem(buckets, "Portfolio Proof", {
        title: `Build proof for ${skill}`,
        reason: (() => {
          const effort = estimateLearningEffort(skill);
          return effort.showHours
            ? `${effort.label}. Only add to resume when you can show a project or work example.`
            : "Only add to resume when you can show a project or work example.";
        })(),
        priority: "High",
      });
    }
  }

  if (data.resume.hasResume) {
    pushItem(buckets, "Portfolio Proof", {
      title: "Add GitHub or portfolio links for strongest project",
      reason: selectedJob
        ? "Recruiters need a clickable artifact for the selected target job."
        : "Recruiters need a clickable artifact across saved jobs.",
      priority: "Medium",
    });
  }

  if (data.jobs.interviewStatusCount > 0 || data.jobs.appliedStatusCount > 0) {
    pushItem(buckets, "Interview Prep", {
      title: "Draft 2 STAR stories from resume evidence",
      reason: "Prepare interview answers tied to projects already on your resume.",
      priority: "Medium",
    });
  }

  if (data.jobs.savedStatusCount > 0) {
    pushItem(buckets, "Job Actions", {
      title: selectedJob ? "Review selected target job status" : "Review saved jobs",
      reason: selectedJob
        ? "Confirm next application step for this target job."
        : `${data.jobs.savedStatusCount} job(s) still marked saved across saved jobs.`,
      priority: "Medium",
    });
  }
  if (data.jobs.appliedStatusCount > 0) {
    pushItem(buckets, "Job Actions", {
      title: "Follow up on applied roles",
      reason: selectedJob
        ? "Keep application momentum for the selected target job."
        : `${data.jobs.appliedStatusCount} application(s) in progress across saved jobs.`,
      priority: "Medium",
    });
  }

  return finalizeBuckets(buckets);
}

export function sanitizeActionCenterSections(
  sections: Array<{ section: string; items: CareerBriefActionCenterSection["items"] }>,
): CareerBriefActionCenterSection[] {
  const buckets = new Map<CareerBriefActionSection, CareerBriefActionCenterSection["items"]>();

  for (const section of sections) {
    const rawSection = section.section;
    const mappedSection: CareerBriefActionSection =
      rawSection === "Before Applying"
        ? "Job Actions"
        : rawSection === "Today" || rawSection === "This Week"
          ? remappedSectionForTitle(section.items[0]?.title ?? "", "Resume Fixes")
          : rawSection === "Job Follow-ups"
            ? "Job Actions"
            : SECTIONS_ORDER.includes(rawSection as CareerBriefActionSection)
              ? (rawSection as CareerBriefActionSection)
              : remappedSectionForTitle(section.items[0]?.title ?? "", "Resume Fixes");

    for (const item of section.items) {
      pushItem(buckets, mappedSection, item);
    }
  }

  return finalizeBuckets(buckets);
}
