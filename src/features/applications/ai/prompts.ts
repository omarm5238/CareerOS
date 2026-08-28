import type { ApplicationAiContext } from "./types";

const SAFETY_RULES = `Truth rules you must never break:
- Never fabricate employer facts. You do not know anything about this company beyond the text provided.
- Never invent recruiter names, contact details, or conversations.
- Never invent interview stages, rounds, or events that were not recorded.
- Never invent salary figures, salary bands, or "what this company usually pays".
- Never invent rejection reasons. Only the confirmed reason supplied to you is a fact.
- Never present a likely factor or inference as a confirmed fact.
- Use only the CareerOS evidence provided in the context.
- If the context is insufficient, say so plainly in the relevant field instead of guessing.
- Clearly distinguish facts from inference.
- Recommend actions the user can take. Do not narrate fictional events.
- Return valid JSON only. No markdown, no code fences, no commentary.`;

export const APPLICATION_NEXT_ACTION_SYSTEM_PROMPT = `You are the CareerOS application operations assistant. You decide the single most useful next action for one job application, based strictly on its recorded state.

${SAFETY_RULES}

Choose exactly one action. "type" must be one of:
SUBMIT_APPLICATION, FOLLOW_UP, CONTACT_RECRUITER, PREPARE_SCREENING, PREPARE_ASSESSMENT, PREPARE_INTERVIEW, REVIEW_OFFER, PROVIDE_DOCUMENTS, UPDATE_RESUME, BUILD_SKILL, WAIT, REVIEW_REJECTION, OTHER.

The action must fit the current status. Do not suggest interview preparation for an application that has only been submitted.

"dueSuggestion" must be one of: "today", "in_3_days", "in_1_week", "in_2_weeks", or null. Never output a calendar date.

Return JSON matching exactly this shape:
{
  "action": {
    "type": "FOLLOW_UP",
    "title": "short imperative title",
    "reason": "why this is the right next step, referencing the actual job and resume evidence",
    "priority": "low | medium | high",
    "dueSuggestion": "in_1_week"
  },
  "evidence": ["facts from the context that justify this action"],
  "warnings": ["risks or missing context worth flagging"]
}`;

export const APPLICATION_STAGE_PREP_SYSTEM_PROMPT = `You are the CareerOS interview and assessment preparation assistant. You prepare a candidate for one specific hiring stage using only their stored CareerOS evidence.

${SAFETY_RULES}

Additional rules for preparation content:
- Base focus areas and likely questions on the actual job description and job analysis provided.
- Never claim "this company always asks X". You have no data about this company's process.
- Ground "evidenceToUse" in real resume bullets, projects, or skills from the context.
- If the job requires something the resume has no evidence for, put it in "risks", not in "evidenceToEmphasize".
- For an OFFER stage, this is NOT interview preparation. Do not generate technical interview questions.
- For OFFER: write a review of terms, documents, and clarification questions. Never estimate market salary or what the company "usually pays".
- For OFFER, map fields as:
  - summary: how to review this offer using only recorded facts
  - focusAreas: compensation items, start date, responsibilities, and conditions to inspect (no invented numbers)
  - likelyQuestions: questions to clarify with the employer (whyLikely = why this term needs confirming)
  - evidenceToEmphasize: documents or conditions to check
  - risks: possible negotiation topics without inventing a salary figure
  - questionsToAsk: additional clarification questions
  - checklist: offer review checklist
  - warnings: include that CareerOS has no market salary data if compensation is discussed

Return JSON matching exactly this shape:
{
  "stage": "SCREENING | ASSESSMENT | INTERVIEW | OFFER",
  "summary": "2-3 sentences on what this stage will focus on",
  "focusAreas": ["topic the candidate should be ready for"],
  "likelyQuestions": [
    { "question": "...", "whyLikely": "which job requirement makes this likely", "evidenceToUse": "which real resume evidence answers it" }
  ],
  "evidenceToEmphasize": ["real experience or project worth leading with"],
  "risks": ["gap or weak evidence that could come up"],
  "questionsToAsk": ["question the candidate should ask them"],
  "checklist": ["concrete preparation step"],
  "warnings": ["anything the candidate should be careful about"]
}`;

export const APPLICATION_REJECTION_SYSTEM_PROMPT = `You are the CareerOS rejection analysis assistant. You help a candidate learn from one rejected application.

${SAFETY_RULES}

The most important rule in this task:
- "confirmedReason" must be copied verbatim from the confirmed reason supplied in the context, or be null if none was supplied. You must never write your own text into that field.
- Everything you infer belongs in "likelyFactors" with an honest confidence level and the evidence you based it on.
- A likely factor is a hypothesis. Phrase it as one. Do not assert why the employer decided anything.
- If no confirmed reason exists, do not imply that your inferences are employer-confirmed.
- Only cite gaps that are visible in the provided job requirements and resume evidence.

Return JSON matching exactly this shape:
{
  "confirmedReason": "verbatim confirmed reason or null",
  "likelyFactors": [
    { "factor": "...", "evidence": "what in the CareerOS data supports this hypothesis", "confidence": "low | medium | high" }
  ],
  "whatWorked": ["genuine strengths this application had"],
  "lessons": ["takeaway for future applications"],
  "resumeChanges": ["specific, evidence-safe resume adjustment"],
  "skillActions": ["skill to build, with why it matters for this role type"],
  "nextActions": ["what to do next"],
  "warnings": ["caveats about the certainty of this analysis"]
}`;

function formatList(label: string, values: string[]): string {
  if (values.length === 0) return `${label}: none recorded`;
  return `${label}: ${values.join(", ")}`;
}

function buildSharedContextBlock(context: ApplicationAiContext): string {
  const lines: string[] = [];

  lines.push(`Application status: ${context.status}`);
  if (context.appliedAt) {
    lines.push(
      `Applied on: ${context.appliedAt}${
        context.daysSinceApplied !== null ? ` (${context.daysSinceApplied} days ago)` : ""
      }`,
    );
  } else {
    lines.push("Applied on: not submitted yet");
  }
  if (context.followUpAt) lines.push(`Follow-up scheduled: ${context.followUpAt}`);
  if (context.upcomingEventAt) lines.push(`Next scheduled event: ${context.upcomingEventAt}`);

  lines.push("");
  lines.push("JOB");
  lines.push(`Title: ${context.job.title ?? "unknown"}`);
  lines.push(`Company: ${context.job.company ?? "unknown"}`);
  if (context.job.location) lines.push(`Location: ${context.job.location}`);
  if (context.job.matchScore !== null) {
    lines.push(
      `CareerOS match score: ${context.job.matchScore}/100 (role alignment: ${
        context.job.roleAlignment ?? "unknown"
      })`,
    );
  }
  lines.push(formatList("Matched skills", context.job.matchedSkills));
  lines.push(formatList("Missing skills / requirements", context.job.missingSkills));
  if (context.job.description) {
    lines.push("Job description:");
    lines.push(context.job.description);
    if (context.job.descriptionTruncated) lines.push("(job description was truncated)");
  }

  lines.push("");
  lines.push("RESUME ACTUALLY SUBMITTED");
  if (!context.resume.available && !context.resume.resumeVersionTitle) {
    lines.push("No CareerOS resume revision was recorded for this application.");
  } else {
    lines.push(
      `Version: ${context.resume.resumeVersionTitle ?? "unknown"} · Revision ${
        context.resume.revisionNumber ?? "unknown"
      }`,
    );
    if (context.resume.alignmentScoreAfter !== null) {
      lines.push(`Estimated ATS alignment: ${context.resume.alignmentScoreAfter}/100`);
    }
    if (context.resume.summary) lines.push(`Summary: ${context.resume.summary}`);
    lines.push(formatList("Core skills", context.resume.coreSkills));
    if (context.resume.experienceBullets.length > 0) {
      lines.push("Experience evidence:");
      for (const bullet of context.resume.experienceBullets) lines.push(`- ${bullet}`);
    }
    if (context.resume.projects.length > 0) {
      lines.push("Project evidence:");
      for (const project of context.resume.projects) lines.push(`- ${project}`);
    }
    lines.push(
      formatList("Job keywords WITHOUT solid resume evidence", context.resume.unsupportedKeywords),
    );
    if (!context.resume.available) {
      lines.push("(the resume record is no longer available; this is the submission snapshot)");
    }
  }

  if (context.timeline.length > 0) {
    lines.push("");
    lines.push("RECORDED TIMELINE (only these events actually happened)");
    for (const entry of context.timeline) {
      lines.push(`- ${entry.eventAt} · ${entry.type} · ${entry.title}`);
    }
  }

  if (context.contacts.length > 0) {
    lines.push("");
    lines.push("RECORDED CONTACTS");
    for (const contact of context.contacts) {
      lines.push(`- ${contact.name}${contact.role ? ` (${contact.role})` : ""}`);
    }
  }

  if (context.notes) {
    lines.push("");
    lines.push(`USER NOTES: ${context.notes}`);
  }
  if (context.companyNotes) {
    lines.push(`USER COMPANY NOTES: ${context.companyNotes}`);
  }

  if (context.documents.length > 0) {
    lines.push("");
    lines.push("DOCUMENT CHECKLIST");
    for (const doc of context.documents) {
      lines.push(`- ${doc.label} · ${doc.status} · source: ${doc.source}`);
    }
  }

  return lines.join("\n");
}

export function buildNextActionUserPrompt(context: ApplicationAiContext): string {
  return `Decide the single best next action for this application.

${buildSharedContextBlock(context)}

Return JSON only.`;
}

export function buildStagePrepUserPrompt(
  context: ApplicationAiContext,
  stage: "SCREENING" | "ASSESSMENT" | "INTERVIEW" | "OFFER",
): string {
  const offerInstructions =
    stage === "OFFER"
      ? `This is an OFFER review, not interview prep.
Do not write technical interview questions.
Do not invent salary, equity, or "what this company usually pays".
User salary notes are separate from your analysis — do not fill them in.
If no offer terms were recorded, say so and give a conservative review checklist.`
      : `Base preparation on the actual job requirements and the exact resume revision used.`;

  return `Prepare this candidate for the ${stage} stage of this specific application.

${offerInstructions}

${buildSharedContextBlock(context)}

Set "stage" to "${stage}". Return JSON only.`;
}

export function buildRejectionUserPrompt(context: ApplicationAiContext): string {
  const confirmed = context.confirmedRejectionReason
    ? `CONFIRMED REJECTION REASON (this is a fact, source: ${
        context.confirmedRejectionSource ?? "unspecified"
      }):\n${context.confirmedRejectionReason}`
    : "CONFIRMED REJECTION REASON: none was recorded. Set \"confirmedReason\" to null and do not imply that your inferences were confirmed by the employer.";

  return `Analyse this rejected application.

${confirmed}

${buildSharedContextBlock(context)}

Return JSON only.`;
}

/** Compact second attempt used when the first call fails or returns bad JSON. */
export function buildRetryPrompt(
  context: ApplicationAiContext,
  task: "next-action" | "stage-prep" | "rejection",
  stage?: string,
): string {
  return JSON.stringify({
    instruction: `Return valid JSON only for the ${task} task. Do not fabricate employer facts.`,
    stage: stage ?? null,
    status: context.status,
    job: {
      title: context.job.title,
      company: context.job.company,
      matchScore: context.job.matchScore,
      matchedSkills: context.job.matchedSkills.slice(0, 8),
      missingSkills: context.job.missingSkills.slice(0, 8),
      description: context.job.description?.slice(0, 1_200) ?? null,
    },
    resume: {
      revisionNumber: context.resume.revisionNumber,
      coreSkills: context.resume.coreSkills.slice(0, 8),
      experienceBullets: context.resume.experienceBullets.slice(0, 5),
      unsupportedKeywords: context.resume.unsupportedKeywords.slice(0, 8),
    },
    confirmedRejectionReason: context.confirmedRejectionReason,
    daysSinceApplied: context.daysSinceApplied,
  });
}
