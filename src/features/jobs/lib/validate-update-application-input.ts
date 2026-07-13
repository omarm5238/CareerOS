import {
  APPLICATION_STATUSES,
  isApplicationStatus,
} from "../constants/application-status";
import type { ApplicationStatus, UpdateJobApplicationInput } from "../types";

type UpdateApplicationValidationResult =
  | { valid: true; data: UpdateJobApplicationInput }
  | { valid: false; message: string; field?: string };

function parseAppliedAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function validateUpdateApplicationInput(
  body: unknown,
): UpdateApplicationValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Invalid request body.", field: "body" };
  }

  const record = body as Record<string, unknown>;

  if (!isApplicationStatus(record.applicationStatus)) {
    return {
      valid: false,
      message: `Status must be one of: ${APPLICATION_STATUSES.join(", ")}.`,
      field: "applicationStatus",
    };
  }

  let applicationNotes: string | null | undefined;
  if (record.applicationNotes === undefined) {
    applicationNotes = undefined;
  } else if (record.applicationNotes === null) {
    applicationNotes = null;
  } else if (typeof record.applicationNotes === "string") {
    applicationNotes = record.applicationNotes.trim() || null;
  } else {
    return {
      valid: false,
      message: "Notes must be a string.",
      field: "applicationNotes",
    };
  }

  const appliedAt = parseAppliedAt(record.appliedAt);
  if (record.appliedAt !== undefined && record.appliedAt !== null && record.appliedAt !== "") {
    if (appliedAt === null) {
      return {
        valid: false,
        message: "Applied date must be a valid ISO date string.",
        field: "appliedAt",
      };
    }
  }

  const data: UpdateJobApplicationInput = {
    applicationStatus: record.applicationStatus as ApplicationStatus,
  };

  if (applicationNotes !== undefined) {
    data.applicationNotes = applicationNotes;
  }

  if (appliedAt !== undefined) {
    data.appliedAt = appliedAt;
  }

  return { valid: true, data };
}
