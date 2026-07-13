import {
  ACCEPTED_RESUME_EXTENSIONS,
  ACCEPTED_RESUME_MIME_TYPES,
  LEGACY_DOC_MESSAGE,
  MAX_RESUME_FILE_SIZE,
} from "../constants";
import type { ResumeValidationResult } from "../types";

type ValidateResumeFileInput = {
  filename: string;
  mimeType: string;
  fileSize: number;
};

export function validateResumeFile(input: ValidateResumeFileInput): ResumeValidationResult {
  const lowerName = input.filename.toLowerCase();

  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    return { valid: false, message: LEGACY_DOC_MESSAGE };
  }

  const hasSupportedExtension = ACCEPTED_RESUME_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );

  if (!hasSupportedExtension) {
    return {
      valid: false,
      message: "Unsupported file type. Please upload a PDF or DOCX file.",
    };
  }

  const expectedMime =
    lowerName.endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (input.mimeType && input.mimeType !== expectedMime) {
    const isAcceptedMime = ACCEPTED_RESUME_MIME_TYPES.includes(
      input.mimeType as (typeof ACCEPTED_RESUME_MIME_TYPES)[number],
    );

    if (!isAcceptedMime) {
      return {
        valid: false,
        message: "Unsupported file type. Please upload a PDF or DOCX file.",
      };
    }
  }

  if (input.fileSize > MAX_RESUME_FILE_SIZE) {
    return {
      valid: false,
      message: "File is too large. Maximum allowed size is 5 MB.",
    };
  }

  if (input.fileSize <= 0) {
    return { valid: false, message: "The uploaded file is empty." };
  }

  return {
    valid: true,
    mimeType: expectedMime,
  };
}
