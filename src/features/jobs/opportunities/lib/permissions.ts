export class OpportunityAccessError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "OpportunityAccessError";
  }
}

export function toOpportunityErrorResponse(error: unknown): { status: number; message: string } | null {
  if (!(error instanceof OpportunityAccessError)) return null;
  const status =
    error.code === "NOT_FOUND"
      ? 404
      : error.code === "FORBIDDEN"
        ? 403
        : error.code === "CONFLICT"
          ? 409
          : 400;
  return { status, message: error.message };
}
