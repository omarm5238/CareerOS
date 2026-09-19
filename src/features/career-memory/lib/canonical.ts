export function slugCanonical(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function entityCanonical(type: string, value: string): string {
  return `${type}:${slugCanonical(value) || "unknown"}`;
}

export function displayName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Unknown";
  return trimmed.slice(0, 120);
}
