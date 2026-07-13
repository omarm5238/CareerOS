import type { ProfileUpdateValidationResult } from "../types";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;

export function validateProfileUpdate(body: unknown): ProfileUpdateValidationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Invalid request body.", field: "body" };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.name !== "string") {
    return { valid: false, message: "Name is required.", field: "name" };
  }

  const name = record.name.trim();

  if (name.length < MIN_NAME_LENGTH) {
    return {
      valid: false,
      message: `Name must be at least ${MIN_NAME_LENGTH} characters.`,
      field: "name",
    };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      message: `Name must be at most ${MAX_NAME_LENGTH} characters.`,
      field: "name",
    };
  }

  return { valid: true, data: { name } };
}
