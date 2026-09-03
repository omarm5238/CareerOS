import { generateJsonWithAI, getAiConfig, logAiFallback } from "@/server/ai";
import { AI_BATCH_SIZE } from "../constants";
import type { AiDeepRankCandidate } from "../types";

const DISCOVERY_SYSTEM_PROMPT = `You are a career intelligence engine that ranks job opportunities for a candidate.

RULES:
- Never invent employer facts.
- Never invent salary.
- Never invent visa sponsorship.
- Never invent work authorization.
- Never invent remote policy.
- Never invent years of user experience.
- Never invent skills the candidate does not have.
- Use only supplied CareerOS evidence.
- Unknown means unknown.
- Do not describe score as hiring probability.
- Return structured JSON only.

Return a JSON object with key "rankings" containing an array of objects, one per candidate.`;

function buildBatchPrompt(
  candidates: { id: string; title: string; company: string; description: string; matchedSkills: string[]; missingSkills: string[] }[],
  userContext: { role: string; skills: string[]; experienceLevel: string; strengths: string[] },
): string {
  const candidateList = candidates.map((c, i) => {
    const desc = c.description.slice(0, 800);
    return `CANDIDATE ${i + 1} (id: ${c.id}):
Title: ${c.title}
Company: ${c.company}
Description (truncated): ${desc}
Pre-matched skills: ${c.matchedSkills.slice(0, 10).join(", ")}
Pre-missing skills: ${c.missingSkills.slice(0, 10).join(", ")}`;
  }).join("\n\n");

  return `CANDIDATE CONTEXT:
Role: ${userContext.role}
Experience: ${userContext.experienceLevel}
Key skills: ${userContext.skills.slice(0, 15).join(", ")}
Strengths: ${userContext.strengths.slice(0, 5).join(", ")}

CANDIDATES TO RANK:
${candidateList}

For each candidate, return:
{
  "candidateId": "the id",
  "aiSuitability": 0-100,
  "matchSummary": "brief why",
  "strongEvidence": ["skill/evidence matches"],
  "missingSkills": ["gaps"],
  "softBlockers": ["concerns"],
  "hardBlockers": ["dealbreakers"],
  "recommendation": "strong" | "possible" | "low",
  "warnings": ["any warnings"]
}

Return JSON: { "rankings": [...] }`;
}

export async function rankDiscoveredJobsBatch(
  candidates: { id: string; title: string; company: string; description: string; matchedSkills: string[]; missingSkills: string[] }[],
  userContext: { role: string; skills: string[]; experienceLevel: string; strengths: string[] },
): Promise<{ ok: true; rankings: AiDeepRankCandidate[] } | { ok: false; reason: string }> {
  const config = getAiConfig();
  if (!config.hasApiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const allRankings: AiDeepRankCandidate[] = [];

  for (let i = 0; i < candidates.length; i += AI_BATCH_SIZE) {
    const batch = candidates.slice(i, i + AI_BATCH_SIZE);
    const prompt = buildBatchPrompt(batch, userContext);

    const model = process.env.OPENAI_DISCOVERY_MODEL?.trim() || config.model;

    const result = await generateJsonWithAI<{ rankings: AiDeepRankCandidate[] }>({
      taskName: `discovery-rank-batch-${Math.floor(i / AI_BATCH_SIZE)}`,
      systemPrompt: DISCOVERY_SYSTEM_PROMPT,
      userPrompt: prompt,
      fallbackLabel: "discovery-rank",
      model,
      timeoutMs: 45_000,
    });

    if (!result.ok) {
      logAiFallback("discovery-rank", result.diagnostic);
      return { ok: false, reason: result.diagnostic.reason };
    }

    const rankings = Array.isArray(result.data?.rankings) ? result.data.rankings : [];

    for (const r of rankings) {
      if (typeof r !== "object" || r === null) continue;
      allRankings.push({
        candidateId: typeof r.candidateId === "string" ? r.candidateId : "",
        aiSuitability: Math.max(0, Math.min(100, typeof r.aiSuitability === "number" ? Math.round(r.aiSuitability) : 0)),
        matchSummary: typeof r.matchSummary === "string" ? r.matchSummary : "",
        strongEvidence: Array.isArray(r.strongEvidence) ? r.strongEvidence.filter((s): s is string => typeof s === "string") : [],
        missingSkills: Array.isArray(r.missingSkills) ? r.missingSkills.filter((s): s is string => typeof s === "string") : [],
        softBlockers: Array.isArray(r.softBlockers) ? r.softBlockers.filter((s): s is string => typeof s === "string") : [],
        hardBlockers: Array.isArray(r.hardBlockers) ? r.hardBlockers.filter((s): s is string => typeof s === "string") : [],
        recommendation: ["strong", "possible", "low"].includes(r.recommendation) ? r.recommendation : "possible",
        warnings: Array.isArray(r.warnings) ? r.warnings.filter((s): s is string => typeof s === "string") : [],
      });
    }
  }

  return { ok: true, rankings: allRankings };
}
