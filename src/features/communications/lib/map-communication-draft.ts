import type {
  CommunicationDraftListItem,
  CommunicationRevisionDetail,
  CommunicationRevisionSummary,
} from "../types";
import { parseChangeLog, parseContextSnapshot, parseEvidenceUsed, parseWarnings } from "./json-parsers";
import type { CommunicationTransformType } from "../types";
import { isRecord } from "./json-parsers";

function transformFromChangeLog(changeLog: { action: string; detail: string }[]): CommunicationTransformType | null {
  const item = changeLog.find((entry) =>
    ["SHORTER", "MORE_FORMAL", "WARMER", "MORE_CONFIDENT"].includes(entry.action),
  );
  return (item?.action as CommunicationTransformType | undefined) ?? null;
}

type RevisionRow = {
  id: string;
  revisionNumber: number;
  source: CommunicationRevisionDetail["source"];
  subject: string | null;
  content: string;
  tone: CommunicationRevisionDetail["tone"];
  length: CommunicationRevisionDetail["length"];
  language: CommunicationRevisionDetail["language"];
  contextSnapshotJson: unknown;
  contextFingerprint: string;
  evidenceUsedJson: unknown;
  warningsJson: unknown;
  changeLogJson: unknown;
  model: string | null;
  aiSource: string | null;
  generationStatus: CommunicationRevisionDetail["generationStatus"];
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapRevisionDetail(row: RevisionRow): CommunicationRevisionDetail {
  return {
    id: row.id,
    revisionNumber: row.revisionNumber,
    source: row.source,
    subject: row.subject,
    content: row.content,
    tone: row.tone,
    length: row.length,
    language: row.language,
    contextSnapshot: parseContextSnapshot(row.contextSnapshotJson),
    contextFingerprint: row.contextFingerprint,
    evidenceUsed: parseEvidenceUsed(row.evidenceUsedJson),
    warnings: parseWarnings(row.warningsJson),
    changeLog: parseChangeLog(row.changeLogJson),
    model: row.model,
    aiSource: row.aiSource,
    generationStatus: row.generationStatus,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapRevisionSummary(
  row: RevisionRow,
  activeRevisionId: string | null,
): CommunicationRevisionSummary {
  const changeLog = parseChangeLog(row.changeLogJson);
  return {
    id: row.id,
    revisionNumber: row.revisionNumber,
    source: row.source,
    subject: row.subject,
    content: row.content,
    tone: row.tone,
    length: row.length,
    language: row.language,
    generationStatus: row.generationStatus,
    model: row.model,
    aiSource: row.aiSource,
    transform: transformFromChangeLog(changeLog),
    createdAt: row.createdAt.toISOString(),
    isActive: row.id === activeRevisionId,
  };
}

export function displayFromSnapshot(snapshot: unknown) {
  const parsed = parseContextSnapshot(snapshot);
  return {
    jobTitle: parsed.job.title,
    company: parsed.job.company,
    location: parsed.job.location,
    recipientName: parsed.contact.name,
    recipientRole: parsed.contact.role,
    applicationStatus: parsed.application.status,
    resumeRevisionNumber: parsed.resume.revisionNumber,
  };
}

type DraftListRow = {
  id: string;
  type: CommunicationDraftListItem["type"];
  status: CommunicationDraftListItem["status"];
  updatedAt: Date;
  contact: { name: string } | null;
  jobPosting: { title: string; company: string } | null;
  activeRevision: {
    language: CommunicationDraftListItem["language"];
    revisionNumber: number;
    contextSnapshotJson: unknown;
  } | null;
};

export function mapDraftListItem(row: DraftListRow): CommunicationDraftListItem {
  const snapshot = row.activeRevision
    ? displayFromSnapshot(row.activeRevision.contextSnapshotJson)
    : null;

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    language: row.activeRevision?.language ?? null,
    recipientName: row.contact?.name ?? snapshot?.recipientName ?? null,
    jobTitle: row.jobPosting?.title ?? snapshot?.jobTitle ?? null,
    company: row.jobPosting?.company ?? snapshot?.company ?? null,
    activeRevisionNumber: row.activeRevision?.revisionNumber ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function snapshotSettingsRecipient(snapshotJson: unknown): string | null {
  if (!isRecord(snapshotJson)) return null;
  const settings = isRecord(snapshotJson.settings) ? snapshotJson.settings : null;
  return typeof settings?.recipientMode === "string" ? settings.recipientMode : null;
}
