import type { CommunicationContext, CommunicationTransformType } from "../types";

export const COMMUNICATION_SYSTEM_PROMPT = `You are the CareerOS communication drafting assistant. You write professional messages the user may copy elsewhere. CareerOS never sends these messages.

Never invent user experience.
Never invent years of experience.
Never invent skills.
Never invent projects.
Never invent employer facts.
Never invent recruiter names.
Never invent company culture.
Never invent salary.
Never invent interview conversations.
Never invent timelines.
Never invent rejection reasons.
Never invent language proficiency.
Use only supplied CareerOS evidence.
Unknown means unknown.
Distinguish user facts from CareerOS inference.
Do not claim CareerOS sent, attached, or submitted anything.
Produce a professional message, not fictional history.
Return structured JSON only.

Trust categories:
- FACT: stored CareerOS records such as job title, application status, contact name, exact resume revision.
- USER INPUT: application notes, salary notes, company notes. Use carefully and do not escalate them into employer facts.
- INTERPRETATION: job analysis scores, matched skills, gaps. These may guide wording. They are not employer statements.

Style:
- Prefer specific evidence over adjectives.
- Avoid thrilled, passionate, dynamic, synergy, innovative organization, perfect fit.
- Keep short paragraphs and a clear purpose.
- Tone changes style only. Tone must not strengthen facts.
- CONFIDENT may be assertive. It must not exaggerate experience.
- Language controls output language only. Do not claim fluency.

Subject:
- Include a subject for emails and outreach.
- Cover letters may use null subject.

Return JSON matching exactly:
{
  "subject": "string or null",
  "content": "string",
  "evidenceUsed": [{"label":"...","source":"resume|job|application|contact|timeline|user_note"}],
  "warnings": [{"code":"...","message":"..."}],
  "changeLog": [{"action":"...","detail":"..."}]
}`;

function factLine(label: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return `${label}: unknown`;
  return `${label}: ${value}`;
}

function listBlock(label: string, values: string[]): string {
  if (values.length === 0) return `${label}: none stored`;
  return `${label}:\n- ${values.join("\n- ")}`;
}

export function buildCommunicationUserPrompt(context: CommunicationContext): string {
  const { user, application, job, jobAnalysis, resume, contact, timeline, settings } = context;

  return `Write a ${settings.type} in ${settings.language}.
Tone: ${settings.tone}
Length: ${settings.length}
Recipient mode: ${settings.recipientMode}
${settings.offerIntent ? `Offer intent: ${settings.offerIntent}` : ""}
Interview occurred confirmed by user: ${settings.interviewOccurredConfirmed ? "yes" : "no"}

USER IDENTITY (FACT)
${factLine("name", user.name)}
${factLine("email", user.email)}
Do not invent phone, LinkedIn, or portfolio values.

JOB (FACT)
${factLine("title", job.title)}
${factLine("company", job.company)}
${factLine("location", job.location)}

JOB ANALYSIS (INTERPRETATION)
${factLine("id", jobAnalysis.id)}
${factLine("matchScore", jobAnalysis.matchScore)}
${factLine("roleAlignment", jobAnalysis.roleAlignment)}
${listBlock("requirements/signals", jobAnalysis.requirements)}
${listBlock("matchedSkills", jobAnalysis.matchedSkills)}
${listBlock("gaps", jobAnalysis.gaps)}
Do not convert these into employer quotes.

RESUME EVIDENCE (FACT from exact revision)
${factLine("versionId", resume.versionId)}
${factLine("revisionId", resume.revisionId)}
${factLine("revisionNumber", resume.revisionNumber)}
${factLine("versionStatus", resume.versionStatus)}
${factLine("alignmentScore", resume.alignmentScore)}
${factLine("summary", resume.summary)}
${listBlock("coreSkills", resume.coreSkills)}
${listBlock("experiencePoints", resume.experiencePoints)}
${listBlock("projects", resume.projects)}
Use 2-3 strongest stored points. Do not invent more.

APPLICATION (FACT)
${application ? `${factLine("id", application.id)}
${factLine("status", application.status)}
${factLine("appliedAt", application.appliedAt)}
${factLine("followUpAt", application.followUpAt)}
${factLine("interviewCompleted", application.interviewCompleted ? "yes" : "no")}
${factLine("interviewCompletedAt", application.interviewCompletedAt)}
${factLine("offerReceived", application.offerReceived ? "yes" : "no")}
${factLine("priorFollowUpsRecorded", application.followUpSentCount)}
${factLine("confirmedRejectionReason", application.confirmedRejectionReason)}
${listBlock("documents", application.documents)}` : "No application is linked. This is job-scoped."}

USER NOTES (USER INPUT)
${factLine("notes", application?.notes ?? null)}
${factLine("companyNotes", application?.companyNotes ?? null)}
${factLine("salaryNotes", application?.salaryNotes ?? null)}

CONTACT (FACT only; never invent a name)
${factLine("name", contact.name)}
${factLine("role", contact.role)}
${factLine("company", contact.company)}
${factLine("email", contact.email)}
If name is unknown, use a safe greeting such as Hello, Hello Hiring Team, or Dear Hiring Team.

TIMELINE (FACT)
${timeline.length > 0 ? timeline.map((event) => `- ${event.type} | ${event.eventAt} | ${event.title}`).join("\n") : "none stored"}

TYPE RULES
COVER_LETTER: role-focused letter grounded in job + 2-3 resume evidence points. No generic praise or invented culture.
APPLICATION_EMAIL: short email, role identification, 1-2 evidence points, optional "I have attached my resume" as draft language only.
RECRUITER_OUTREACH: concise, purpose-first, no "I hope this message finds you well".
FOLLOW_UP: use appliedAt and follow-up history. Do not say this is a second follow-up unless followUpSentCount >= 1.
INTERVIEW_THANK_YOU: only if interviewCompleted is yes. Neutral wording. Do not invent discussion topics.
POST_INTERVIEW_FOLLOW_UP: completed interview + waiting. Do not invent promised dates.
OFFER_RESPONSE: follow offerIntent. Do not invent salary, market ranges, or deadlines.
GENERAL_PROFESSIONAL_MESSAGE: still bound to this job/application. If rejected, thank-you / keep-in-touch only. Do not argue.

If resume versionStatus is DRAFT, add warning: selected resume has not been marked Ready.
If no contact name, add warning: no recruiter name available.
If no salary notes and type is OFFER_RESPONSE/NEGOTIATE, add warning: no salary information is stored.
Never claim CareerOS attached or sent a file.`;
}

export function buildTransformUserPrompt(
  context: CommunicationContext,
  transform: CommunicationTransformType,
  subject: string | null,
  content: string,
): string {
  return `Rewrite the active communication using transform ${transform}.
Keep every fact identical. Do not add experience, skills, employers, salary, interview details, or names.
${transform === "SHORTER" ? "The result MUST be shorter than the source." : ""}
${transform === "MORE_CONFIDENT" ? "Be more assertive without upgrading claims." : ""}
${transform === "MORE_FORMAL" ? "Increase formality without inventing titles." : ""}
${transform === "WARMER" ? "Increase warmth without becoming casual or inventing rapport." : ""}

Current settings: type=${context.settings.type} tone=${context.settings.tone} language=${context.settings.language}
Job: ${context.job.title ?? "unknown"} at ${context.job.company ?? "unknown"}
Contact: ${context.contact.name ?? "unknown"}

SOURCE SUBJECT:
${subject ?? "(none)"}

SOURCE CONTENT:
${content}

Return the same JSON shape. changeLog should include action=${transform}.`;
}
