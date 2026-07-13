import { TEXT_PREVIEW_MAX_LENGTH } from "../constants";
import { extractDocxText } from "./extract-docx-text";
import { extractPdfText } from "./extract-pdf-text";
import { createTextPreview, normalizeResumeText } from "./normalize-resume-text";

type ExtractResumeTextInput = {
  buffer: Buffer;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
};

export type ExtractResumeTextResult = {
  normalizedText: string;
  textPreview: string;
  textLength: number;
  warnings: string[];
};

export async function extractResumeText(
  input: ExtractResumeTextInput,
): Promise<ExtractResumeTextResult> {
  const warnings: string[] = [];
  let rawText = "";

  if (input.mimeType === "application/pdf") {
    rawText = await extractPdfText(input.buffer);
  } else {
    rawText = await extractDocxText(input.buffer);
  }

  const normalizedText = normalizeResumeText(rawText);

  if (!normalizedText) {
    throw new Error("Could not extract readable text from this resume.");
  }

  if (normalizedText.length < 80) {
    throw new Error(
      "Extracted resume text is too short. Please upload a resume with more readable content.",
    );
  }

  if (normalizedText.length < 200) {
    warnings.push("Extracted text appears limited. Review the analysis carefully.");
  }

  return {
    normalizedText,
    textPreview: createTextPreview(normalizedText, TEXT_PREVIEW_MAX_LENGTH),
    textLength: normalizedText.length,
    warnings,
  };
}
