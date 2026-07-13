import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { validateResumeFile } from "@/features/resume";
import { analyzeResumeWithAi } from "@/features/resume/ai";
import { extractResumeText, saveResumeAnalysis } from "@/features/resume/server";
import { auth } from "@/server/auth";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No resume file was uploaded." }, { status: 400 });
    }

    const validation = validateResumeFile({
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    if (!validation.valid) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let extracted;
    try {
      extracted = await extractResumeText({
        buffer,
        mimeType: validation.mimeType,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not extract readable text from this resume.";

      return NextResponse.json({ message }, { status: 422 });
    }

    const analysis = await analyzeResumeWithAi({
      text: extracted.normalizedText,
      resumeMeta: {
        filename: file.name,
        fileSize: file.size,
      },
      extractionWarnings: extracted.warnings,
    });

    let saved;
    try {
      saved = await saveResumeAnalysis({
        userId: session.user.id,
        filename: file.name,
        mimeType: validation.mimeType,
        fileSize: file.size,
        textLength: extracted.textLength,
        textPreview: extracted.textPreview,
        analysis,
      });
    } catch {
      return NextResponse.json(
        { message: "Could not save resume analysis. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...analysis,
      resumeDocumentId: saved.id,
      analysisId: saved.analysis?.id,
    });
  } catch {
    return NextResponse.json(
      { message: "Resume analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
