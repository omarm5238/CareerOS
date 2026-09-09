import { OpportunityAccessError, toOpportunityErrorResponse } from "@/features/jobs/opportunities/lib/permissions";
import { toApplicationErrorResponse } from "@/features/applications/lib/application-permissions";

export class ExecutionAccessError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "ExecutionAccessError";
  }
}

export function toExecutionErrorResponse(error: unknown): { status: number; message: string } | null {
  if (error instanceof ExecutionAccessError) {
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
  return toOpportunityErrorResponse(error) ?? toApplicationErrorResponse(error);
}

export { OpportunityAccessError };
