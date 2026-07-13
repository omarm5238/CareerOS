export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024;

export const MIN_EXTRACTED_TEXT_LENGTH = 80;

export const TEXT_PREVIEW_MAX_LENGTH = 1000;

export { SOFTWARE_SKILL_CATALOG as RESUME_SKILL_CATALOG } from "./domain-skills";
export {
  DESIGN_SKILL_CATALOG,
  SOFTWARE_SKILL_CATALOG,
} from "./domain-skills";

export const ACCEPTED_RESUME_EXTENSIONS = [".pdf", ".docx"] as const;

export const ACCEPTED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const LEGACY_DOC_MESSAGE =
  "Legacy .doc files are not supported yet. Please upload PDF or DOCX.";
