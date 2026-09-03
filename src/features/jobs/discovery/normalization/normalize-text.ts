/** Strip HTML tags and collapse whitespace for safe display. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6]|tr|td|th|blockquote|pre)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeTitle(title: string): string {
  return title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s*[/|,]\s*/g, " ")
    .replace(/\b(m|f|d|x|w|all genders?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeCompany(company: string): string {
  return company
    .replace(/\b(inc\.?|ltd\.?|llc|gmbh|ag|co\.?|corp\.?|plc|s\.?a\.?|b\.?v\.?)\b/gi, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  if (!trimmed || trimmed.toLowerCase() === "remote" || trimmed.toLowerCase() === "anywhere") return null;
  return trimmed;
}
