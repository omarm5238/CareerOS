import { prisma } from "@/server/db/prisma";

import {
  APPLICATION_DOCUMENT_SOURCES,
  APPLICATION_DOCUMENT_STATUSES,
} from "../types";
import type {
  ApplicationDocumentItem,
  ApplicationDocumentSource,
  ApplicationDocumentStatus,
} from "../types";
import {
  ApplicationAccessError,
  assertApplicationOwnedByUser,
} from "./application-permissions";
import { isRecord, toPrismaJson } from "./json-parsers";

const NOTE_LIMIT = 4_000;
const DOCUMENT_LIMIT = 20;

export type UpdateApplicationDetailsInput = {
  userId: string;
  applicationId: string;
  notes?: string | null;
  companyNotes?: string | null;
  salaryNotes?: string | null;
  documents?: unknown;
};

function cleanNote(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, NOTE_LIMIT) : null;
}

function validateDocuments(value: unknown): ApplicationDocumentItem[] {
  if (!Array.isArray(value)) {
    throw new ApplicationAccessError("INVALID_INPUT", "Documents must be a list.");
  }

  return value
    .filter(isRecord)
    .map((item) => {
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const status = APPLICATION_DOCUMENT_STATUSES.includes(
        item.status as ApplicationDocumentStatus,
      )
        ? (item.status as ApplicationDocumentStatus)
        : "needed";
      const source = APPLICATION_DOCUMENT_SOURCES.includes(
        item.source as ApplicationDocumentSource,
      )
        ? (item.source as ApplicationDocumentSource)
        : "USER_ADDED";
      const note = typeof item.note === "string" ? item.note.trim() : "";

      return {
        label: label.slice(0, 120),
        status,
        source,
        ...(note ? { note: note.slice(0, 400) } : {}),
      };
    })
    .filter((item) => item.label.length > 0)
    .slice(0, DOCUMENT_LIMIT);
}

/**
 * Saves user-entered notes and the document checklist. Notes are deliberately
 * not timeline events — only meaningful milestones belong in the timeline.
 */
export async function updateApplicationDetails(input: UpdateApplicationDetailsInput) {
  await assertApplicationOwnedByUser(input.userId, input.applicationId);

  const notes = cleanNote(input.notes);
  const companyNotes = cleanNote(input.companyNotes);
  const salaryNotes = cleanNote(input.salaryNotes);
  const documents = input.documents !== undefined ? validateDocuments(input.documents) : undefined;

  return prisma.application.update({
    where: { id: input.applicationId },
    data: {
      ...(notes !== undefined ? { notes } : {}),
      ...(companyNotes !== undefined ? { companyNotes } : {}),
      ...(salaryNotes !== undefined ? { salaryNotes } : {}),
      ...(documents !== undefined ? { documentsNeededJson: toPrismaJson(documents) } : {}),
      lastActivityAt: new Date(),
    },
    select: { id: true, updatedAt: true },
  });
}
