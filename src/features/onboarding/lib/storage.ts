"use client";

import { mockCareerProfile } from "../constants";
import type { OnboardingProfile, OnboardingStoredState } from "../types";

const STORAGE_KEY = "careeros:onboarding:v1";

function isValidStoredState(value: unknown): value is OnboardingStoredState {
  if (!value || typeof value !== "object") return false;

  const data = value as Partial<OnboardingStoredState>;
  return (
    data.version === 1 &&
    data.completed === true &&
    typeof data.completedAt === "string" &&
    !!data.resume &&
    typeof data.resume.filename === "string" &&
    typeof data.resume.fileSize === "number" &&
    !!data.profile &&
    typeof data.profile.role === "string" &&
    typeof data.profile.experienceLevel === "string" &&
    typeof data.profile.completenessScore === "number" &&
    Array.isArray(data.profile.detectedSkills) &&
    Array.isArray(data.profile.suggestedFocus)
  );
}

export function readOnboardingState(): OnboardingStoredState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    return isValidStoredState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeOnboardingCompletedState(input: {
  resumeFileName: string;
  resumeFileSize: number;
  profile?: OnboardingProfile;
}): OnboardingStoredState | null {
  if (typeof window === "undefined") return null;

  const profile = input.profile ?? mockCareerProfile;

  const state: OnboardingStoredState = {
    version: 1,
    completed: true,
    completedAt: new Date().toISOString(),
    resume: {
      filename: input.resumeFileName,
      fileSize: input.resumeFileSize,
    },
    profile,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return null;
  }
}

export function clearOnboardingState() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Intentionally ignored.
  }
}

export { STORAGE_KEY as onboardingStorageKey };
