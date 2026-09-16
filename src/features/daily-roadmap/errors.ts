export class DailyRoadmapAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT";

  constructor(
    code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "DailyRoadmapAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<DailyRoadmapAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
};

export function toDailyRoadmapErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof DailyRoadmapAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}
