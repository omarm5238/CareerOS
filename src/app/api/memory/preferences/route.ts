import { NextResponse } from "next/server";

import {
  getOrCreateCareerMemoryPreference,
  handleCareerMemoryError,
  readJsonBody,
  requireCareerMemoryUser,
  toPreferenceView,
  updateCareerMemoryPreference,
} from "@/features/career-memory/server";

export async function GET() {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const row = await getOrCreateCareerMemoryPreference(auth.userId);
    return NextResponse.json({ preferences: toPreferenceView(row) });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireCareerMemoryUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readJsonBody(request);
    const row = await updateCareerMemoryPreference(auth.userId, {
      memoryEnabled: typeof body.memoryEnabled === "boolean" ? body.memoryEnabled : undefined,
      allowBehavioralMemory: typeof body.allowBehavioralMemory === "boolean" ? body.allowBehavioralMemory : undefined,
      allowDerivedPatterns: typeof body.allowDerivedPatterns === "boolean" ? body.allowDerivedPatterns : undefined,
      allowLongTermPreferences:
        typeof body.allowLongTermPreferences === "boolean" ? body.allowLongTermPreferences : undefined,
    });
    return NextResponse.json({ preferences: toPreferenceView(row) });
  } catch (error) {
    return handleCareerMemoryError(error);
  }
}
