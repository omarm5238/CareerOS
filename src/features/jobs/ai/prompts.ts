export const JOB_MATCH_SYSTEM_PROMPT = `You are a career job-matching analyst. Compare a candidate resume profile against a job posting.

Rules:
- Return valid JSON only. No markdown, no commentary outside JSON.
- Base every claim on the provided resume profile and job posting text.
- Do NOT invent skills, experience, or credentials the resume does not support.
- Do NOT tell the candidate to claim skills they do not actually have.
- Do NOT provide generic advice like "improve your resume", "network more", or "work harder".
- Give concrete, actionable guidance tied to this specific job and profile.
- matchScore must be an integer from 0 to 100 reflecting realistic fit.
- roleAlignment must be exactly one of: "Strong", "Partial", "Weak", "Unknown".
- matchedSkills: skills from the job that the resume clearly supports (max 12).
- missingSkills: skills required or implied by the job that the resume lacks (max 12).
- resumeSignals: evidence-based signals from the resume profile (max 8).
- jobSignals: key requirements or themes from the job posting (max 8).
- recommendations: practical next steps for this application (max 8).
- fitSummary: concise explanation of the match in plain language (max 700 characters).
- applicationStrategy: ordered steps for how to position this application (max 6).
- resumeTailoringTips: specific resume edits for this job (max 6).
- warnings: notes about gaps, missing data, or uncertainty (max 6).`;

export function buildJobMatchUserPrompt(input: {
  resume: {
    detectedRole: string;
    experienceLevel: string;
    completenessScore: number;
    detectedSkills: string[];
    profileSummary: string | null;
    strengths: string[];
    weaknesses: string[];
    suggestedFocus: string[];
    atsRecommendations: string[];
  };
  job: {
    title: string;
    company: string;
    location: string | null;
    description: string;
    source: string | null;
    jobUrl: string | null;
    descriptionTruncated: boolean;
  };
}): string {
  const truncationNote = input.job.descriptionTruncated
    ? "\nNote: Job description was truncated for analysis."
    : "";

  return `Analyze this job match.

RESUME PROFILE
Role: ${input.resume.detectedRole}
Experience level: ${input.resume.experienceLevel}
Completeness score: ${input.resume.completenessScore}
Detected skills: ${input.resume.detectedSkills.join(", ") || "None listed"}
Profile summary: ${input.resume.profileSummary ?? "Not provided"}
Strengths: ${input.resume.strengths.join("; ") || "None listed"}
Weaknesses: ${input.resume.weaknesses.join("; ") || "None listed"}
Suggested focus: ${input.resume.suggestedFocus.join("; ") || "None listed"}
ATS recommendations: ${input.resume.atsRecommendations.join("; ") || "None listed"}

JOB POSTING
Title: ${input.job.title}
Company: ${input.job.company}
Location: ${input.job.location ?? "Not specified"}
Source: ${input.job.source ?? "Not specified"}
URL: ${input.job.jobUrl ?? "Not provided"}

Description:
${input.job.description}${truncationNote}

Return JSON with keys:
matchScore, roleAlignment, matchedSkills, missingSkills, resumeSignals, jobSignals, recommendations, fitSummary, applicationStrategy, resumeTailoringTips, warnings`;
}
