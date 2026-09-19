export class WeeklyReviewAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT";

  constructor(
    code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "WeeklyReviewAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<WeeklyReviewAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
};

export function toWeeklyReviewErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof WeeklyReviewAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}
