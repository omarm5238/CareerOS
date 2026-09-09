export function nowMs(): number {
  const override = Number(process.env.CAREEROS_SUBMISSION_NOW_MS);
  if (Number.isFinite(override) && override > 0) return override;
  return Date.now();
}

export function approvalTtlMs(): number {
  const override = Number(process.env.CAREEROS_SUBMISSION_APPROVAL_TTL_MS);
  if (Number.isFinite(override) && override > 0) return override;
  return 5 * 60 * 1000;
}
