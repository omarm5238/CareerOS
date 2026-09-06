import type { CommunicationContext, CommunicationGenerationOutput } from "../types";
import { clipMultiline, clipText, parseChangeLog, parseEvidenceUsed, parseWarnings } from "../lib/json-parsers";

const SUBJECT_MAX = 180;

function contentLimit(context: CommunicationContext): number {
  const type = context.settings.type;
  const length = context.settings.length;

  if (type === "RECRUITER_OUTREACH") return length === "DETAILED" ? 900 : 650;
  if (type === "FOLLOW_UP" || type === "INTERVIEW_THANK_YOU") return 800;
  if (type === "APPLICATION_EMAIL") return length === "DETAILED" ? 1_100 : 800;
  if (type === "COVER_LETTER") return length === "DETAILED" ? 2_400 : length === "SHORT" ? 1_000 : 1_800;
  if (type === "OFFER_RESPONSE") return length === "DETAILED" ? 1_400 : 1_000;
  return length === "DETAILED" ? 1_800 : length === "SHORT" ? 700 : 1_200;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeCommunicationOutput(
  payload: unknown,
  context: CommunicationContext,
): CommunicationGenerationOutput | null {
  if (!isRecord(payload)) return null;

  const content = clipMultiline(
    typeof payload.content === "string" ? payload.content : "",
    contentLimit(context),
  );
  if (!content) return null;

  const subjectRaw = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const subject = subjectRaw ? clipText(subjectRaw, SUBJECT_MAX) : null;

  const warnings = parseWarnings(payload.warnings);
  if (context.resume.versionStatus === "DRAFT") {
    const exists = warnings.some((item) => item.code === "resume_not_ready");
    if (!exists) {
      warnings.unshift({
        code: "resume_not_ready",
        message: "The selected resume has not been marked Ready.",
      });
    }
  }
  if (!context.contact.name && context.settings.recipientMode !== "HIRING_TEAM") {
    const exists = warnings.some(
      (item) =>
        item.code === "no_contact_name" ||
        item.message.toLowerCase().includes("no recruiter name"),
    );
    if (!exists) {
      warnings.push({
        code: "no_contact_name",
        message: "No recruiter name available.",
      });
    }
  }

  return {
    subject,
    content,
    evidenceUsed: parseEvidenceUsed(payload.evidenceUsed),
    warnings: warnings.slice(0, 10),
    changeLog: parseChangeLog(payload.changeLog),
  };
}
