import type { ResumeTailoringInput } from "./types";

export const RESUME_TAILORING_SYSTEM_PROMPT = `You are a resume tailoring specialist. You adapt an existing resume for one specific job posting.

Core rule: optimize the truth. Never fabricate experience.

You are allowed to:
- reframe experience that already exists in the resume
- reorder and regroup skills the candidate already has
- emphasize real projects already described in the resume
- rewrite the professional summary using only supported facts
- rewrite bullets to use job-relevant vocabulary for evidence that already exists
- map job keywords to existing evidence when the evidence genuinely supports them
- identify job keywords with no supporting evidence

You are NOT allowed to:
- invent companies, employers, job titles, or dates
- invent years of experience or seniority
- invent certifications, degrees, or education
- invent production, scale, or team-leadership experience
- claim expertise in a skill with no evidence in the resume
- add a missing skill as confirmed experience
- turn a learning goal, course, or intention into work experience
- hide important blockers such as seniority gaps or hard requirements

If the job requires something the candidate cannot evidence, it must appear in keywordCoverage with action "add_to_roadmap" or "keep_out_of_resume", plus a warning and an evidence note. It must never appear in summary, coreSkills, technicalSkills, experienceBullets, or projects as real experience.

Every experienceBullets and projects entry must set evidenceStrength honestly:
- "strong": the resume clearly states this
- "medium": the resume implies this
- "weak": only loosely supported
- "none": not supported (do not output bullets with "none")

alignmentScoreBefore and alignmentScoreAfter are estimates between 0 and 100. They are not a guarantee of ATS acceptance. alignmentScoreAfter must stay realistic; do not exceed alignmentScoreBefore by more than 25 points, because reordering words cannot create missing experience.

Hard limits:
- coreSkills: max 12
- technicalSkills: max 8 categories, max 12 skills per category
- experienceBullets: max 8
- projects: max 6
- education: max 6
- certifications: max 6
- keywordCoverage: max 30
- warnings: max 12
- changeLog: max 12
- evidenceNotes: max 20

Explain every meaningful edit in changeLog. Explain every unsupported or risky claim in warnings and evidenceNotes.

Return valid JSON only. No markdown, no commentary outside JSON.`;

const OUTPUT_SHAPE = `{
  "tailoredTitle": "string",
  "summary": "string",
  "coreSkills": ["string"],
  "technicalSkills": [{ "category": "string", "skills": ["string"] }],
  "experienceBullets": [
    {
      "source": "string",
      "original": "string",
      "tailored": "string",
      "rationale": "string",
      "evidenceStrength": "strong | medium | weak | none"
    }
  ],
  "projects": [
    {
      "source": "string",
      "original": "string",
      "tailored": "string",
      "rationale": "string",
      "evidenceStrength": "strong | medium | weak | none"
    }
  ],
  "education": ["string"],
  "certifications": ["string"],
  "keywordCoverage": [
    {
      "keyword": "string",
      "type": "technical_skill | tool | framework | domain | experience | soft_skill | certification | education | other",
      "importance": "high | medium | low",
      "requiredByJob": true,
      "presentInOriginalResume": true,
      "usedInTailoredResume": true,
      "evidenceStrength": "strong | medium | weak | none",
      "action": "use_safely | rephrase_existing_evidence | move_higher | add_to_project_evidence | keep_out_of_resume | add_to_roadmap",
      "note": "string"
    }
  ],
  "warnings": [
    {
      "type": "missing_evidence | seniority_gap | keyword_missing | overclaim_risk | formatting_note | other",
      "severity": "low | medium | high",
      "message": "string",
      "recommendation": "string"
    }
  ],
  "changeLog": [{ "section": "string", "change": "string", "reason": "string" }],
  "evidenceNotes": [
    {
      "claim": "string",
      "evidence": "string",
      "strength": "strong | medium | weak | none",
      "safeToUse": true
    }
  ],
  "alignmentScoreBefore": 0,
  "alignmentScoreAfter": 0
}`;

function list(values: string[], limit: number): string {
  const trimmed = values.filter((value) => value.trim().length > 0).slice(0, limit);
  return trimmed.length > 0 ? trimmed.join(", ") : "none recorded";
}

export function buildResumeTailoringUserPrompt(input: ResumeTailoringInput): string {
  const { resume, job } = input;

  return `TARGET JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? "not specified"}
Current match score: ${job.matchScore ?? "not analyzed"}
Role alignment: ${job.roleAlignment ?? "not analyzed"}
Matched skills: ${list(job.matchedSkills, 20)}
Missing skills: ${list(job.missingSkills, 20)}
Non-skill blockers: ${list(job.nonSkillBlockers, 10)}
Existing tailoring tips: ${list(job.resumeTailoringTips, 8)}
Application strategy notes: ${list(job.applicationStrategy, 6)}

JOB DESCRIPTION${job.descriptionTruncated ? " (truncated)" : ""}:
"""
${job.description}
"""

CANDIDATE RESUME PROFILE
Detected role: ${resume.detectedRole}
Experience level: ${resume.experienceLevel}
Resume completeness: ${resume.completenessScore}
Detected skills: ${list(resume.detectedSkills, 30)}
Strengths: ${list(resume.strengths, 8)}
Weaknesses: ${list(resume.weaknesses, 8)}
Suggested focus: ${list(resume.suggestedFocus, 8)}
ATS recommendations: ${list(resume.atsRecommendations, 8)}
Profile summary: ${resume.profileSummary?.trim() || "none recorded"}

ORIGINAL RESUME TEXT${resume.textPreviewTruncated ? " (truncated)" : ""}:
"""
${resume.textPreview}
"""

TASK
Produce a tailored resume version for this exact job, using only evidence found above.
Set alignmentScoreBefore to your estimate of how well the ORIGINAL resume aligns with this job.
Set alignmentScoreAfter to your estimate for the TAILORED version.
Every missing job requirement must appear in keywordCoverage and warnings instead of being written into the resume.

Return JSON matching exactly this shape:
${OUTPUT_SHAPE}`;
}

export function buildResumeTailoringRetryPrompt(input: ResumeTailoringInput): string {
  const { resume, job } = input;

  return JSON.stringify({
    instruction:
      "Return compact JSON only, matching the required resume tailoring shape. Do not fabricate experience. Missing requirements go to keywordCoverage and warnings, never into the resume body.",
    job: {
      title: job.title,
      company: job.company,
      matchScore: job.matchScore,
      matchedSkills: job.matchedSkills.slice(0, 12),
      missingSkills: job.missingSkills.slice(0, 12),
      description: job.description.slice(0, 1_600),
    },
    resume: {
      role: resume.detectedRole,
      experienceLevel: resume.experienceLevel,
      detectedSkills: resume.detectedSkills.slice(0, 20),
      profileSummary: resume.profileSummary?.slice(0, 500) ?? null,
      strengths: resume.strengths.slice(0, 5),
      text: resume.textPreview.slice(0, 2_400),
    },
    requiredKeys: [
      "tailoredTitle",
      "summary",
      "coreSkills",
      "technicalSkills",
      "experienceBullets",
      "projects",
      "education",
      "certifications",
      "keywordCoverage",
      "warnings",
      "changeLog",
      "evidenceNotes",
      "alignmentScoreBefore",
      "alignmentScoreAfter",
    ],
  });
}
