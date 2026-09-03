import { generateJsonWithAI, getAiConfig, logAiFallback } from "@/server/ai";
import type { JobDiscoveryRoleTarget, JobDiscoveryLocationTarget, JobDiscoveryProfileData } from "../types";

const PROFILE_SYSTEM_PROMPT = `You are a career intelligence engine that generates job search profiles.

RULES:
- Never invent employer facts.
- Never invent skills the candidate does not have.
- Use only supplied CareerOS evidence.
- Do not recommend unsupported role families without evidence.
- Return structured JSON only.

Return a JSON object with the profile configuration.`;

interface ProfileGenerationInput {
  detectedRole: string | null;
  experienceLevel: string | null;
  detectedSkills: string[];
  profileSummary: string | null;
  strengths: string[];
  weaknesses: string[];
  existingJobTitles: string[];
}

interface AiProfileResponse {
  roleTargets: { title: string; aliases: string[]; priority: string; confidence: string; evidence: string[] }[];
  locationTargets: { countryCode: string; country: string; cities: string[] }[];
  workModes: string[];
  experienceLevels: string[];
}

export async function generateSearchProfileWithAi(
  input: ProfileGenerationInput,
): Promise<{ ok: true; data: Partial<JobDiscoveryProfileData> } | { ok: false }> {
  const config = getAiConfig();
  if (!config.hasApiKey) return { ok: false };

  const prompt = `Generate a job search profile for this candidate.

Detected role: ${input.detectedRole ?? "Unknown"}
Experience level: ${input.experienceLevel ?? "Unknown"}
Skills: ${input.detectedSkills.slice(0, 20).join(", ")}
Profile: ${input.profileSummary?.slice(0, 500) ?? "Not available"}
Strengths: ${input.strengths.slice(0, 5).join(", ")}
Weaknesses: ${input.weaknesses.slice(0, 5).join(", ")}
Previous job titles analyzed: ${input.existingJobTitles.slice(0, 5).join(", ")}

Return JSON:
{
  "roleTargets": [{"title": "...", "aliases": ["..."], "priority": "high|medium|low", "confidence": "strong|medium|weak", "evidence": ["..."]}],
  "locationTargets": [{"countryCode": "...", "country": "...", "cities": []}],
  "workModes": ["REMOTE", "HYBRID", "ONSITE"],
  "experienceLevels": ["..."]
}`;

  const result = await generateJsonWithAI<AiProfileResponse>({
    taskName: "generate-search-profile",
    systemPrompt: PROFILE_SYSTEM_PROMPT,
    userPrompt: prompt,
    fallbackLabel: "search-profile",
    model: config.model,
    timeoutMs: 30_000,
  });

  if (!result.ok) {
    logAiFallback("search-profile", result.diagnostic);
    return { ok: false };
  }

  const d = result.data;
  const roleTargets: JobDiscoveryRoleTarget[] = (Array.isArray(d.roleTargets) ? d.roleTargets : [])
    .filter((r): r is { title: string; aliases: string[]; priority: string; confidence: string; evidence: string[] } =>
      typeof r === "object" && r !== null && typeof r.title === "string")
    .map(r => ({
      title: r.title,
      aliases: Array.isArray(r.aliases) ? r.aliases.filter((a): a is string => typeof a === "string") : [],
      priority: (["high", "medium", "low"].includes(r.priority) ? r.priority : "medium") as "high" | "medium" | "low",
      confidence: (["strong", "medium", "weak"].includes(r.confidence) ? r.confidence : "medium") as "strong" | "medium" | "weak",
      evidence: Array.isArray(r.evidence) ? r.evidence.filter((e): e is string => typeof e === "string") : [],
      enabled: true,
    }));

  const locationTargets: JobDiscoveryLocationTarget[] = (Array.isArray(d.locationTargets) ? d.locationTargets : [])
    .filter((l): l is { countryCode: string; country: string; cities: string[] } =>
      typeof l === "object" && l !== null && typeof l.countryCode === "string")
    .map(l => ({
      countryCode: l.countryCode,
      country: typeof l.country === "string" ? l.country : l.countryCode,
      cities: Array.isArray(l.cities) ? l.cities.filter((c): c is string => typeof c === "string") : [],
      enabled: true,
    }));

  return {
    ok: true,
    data: {
      roleTargets,
      locationTargets,
      workModes: Array.isArray(d.workModes) ? d.workModes.filter((m): m is string => typeof m === "string") : ["REMOTE"],
      experienceLevels: Array.isArray(d.experienceLevels) ? d.experienceLevels.filter((e): e is string => typeof e === "string") : [],
    },
  };
}

export function generateFallbackProfile(input: ProfileGenerationInput): Partial<JobDiscoveryProfileData> {
  const roleTargets: JobDiscoveryRoleTarget[] = [];

  if (input.detectedRole) {
    roleTargets.push({
      title: input.detectedRole,
      aliases: [],
      priority: "high",
      confidence: "strong",
      evidence: ["From resume analysis"],
      enabled: true,
    });
  }

  for (const jobTitle of input.existingJobTitles.slice(0, 3)) {
    if (!roleTargets.find(r => r.title.toLowerCase() === jobTitle.toLowerCase())) {
      roleTargets.push({
        title: jobTitle,
        aliases: [],
        priority: "medium",
        confidence: "medium",
        evidence: ["From analyzed jobs"],
        enabled: true,
      });
    }
  }

  if (roleTargets.length === 0) {
    roleTargets.push({
      title: "Software Engineer",
      aliases: ["Developer", "Software Developer"],
      priority: "medium",
      confidence: "weak",
      evidence: ["Default fallback"],
      enabled: true,
    });
  }

  return {
    roleTargets,
    locationTargets: [],
    workModes: ["REMOTE"],
    experienceLevels: input.experienceLevel ? [input.experienceLevel] : [],
  };
}
