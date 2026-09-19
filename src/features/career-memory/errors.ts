export class CareerMemoryAccessError extends Error {
  readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT";

  constructor(
    code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "CareerMemoryAccessError";
    this.code = code;
  }
}

const ACCESS_ERROR_STATUS: Record<CareerMemoryAccessError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
};

export function toCareerMemoryErrorResponse(
  error: unknown,
): { status: number; message: string } | null {
  if (!(error instanceof CareerMemoryAccessError)) return null;
  return { status: ACCESS_ERROR_STATUS[error.code], message: error.message };
}
