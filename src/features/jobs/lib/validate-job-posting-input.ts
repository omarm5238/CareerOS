import { MIN_JOB_DESCRIPTION_LENGTH } from "../constants";
import type { CreateJobPostingInput, JobFormValidationResult } from "../types";

function trimOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateJobPostingInput(raw: unknown): JobFormValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, message: "Invalid job payload." };
  }

  const body = raw as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const location = trimOptional(body.location);
  const jobUrl = trimOptional(body.jobUrl);
  const source = trimOptional(body.source);

  if (!title) {
    return { valid: false, message: "Job title is required.", field: "title" };
  }

  if (!company) {
    return { valid: false, message: "Company is required.", field: "company" };
  }

  if (!description) {
    return {
      valid: false,
      message: "Job description is required.",
      field: "description",
    };
  }

  if (description.length < MIN_JOB_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      message: `Job description must be at least ${MIN_JOB_DESCRIPTION_LENGTH} characters.`,
      field: "description",
    };
  }

  if (jobUrl && !isValidHttpUrl(jobUrl)) {
    return {
      valid: false,
      message: "Job URL must be a valid http or https link.",
      field: "jobUrl",
    };
  }

  const data: CreateJobPostingInput = {
    title,
    company,
    description,
    location,
    jobUrl,
    source,
  };

  return { valid: true, data };
}
