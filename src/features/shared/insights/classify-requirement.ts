export type RequirementKind =
  | "skill"
  | "experience_gap"
  | "evidence_gap"
  | "context_requirement";

/** Spec aliases used in Patch 20.4.3 docs. */
export type TechnicalRequirementKind =
  | "technical_skill"
  | "experience_gap"
  | "proof_gap"
  | "role_context";

export type ClassifiedRequirement = {
  value: string;
  kind: RequirementKind;
  label: "Skill" | "Experience gap" | "Evidence gap" | "Role requirement";
};

const EXPERIENCE =
  /\b(\d+\+?\s*(?:years?|yrs?)|senior(?:ity)?|junior|mid[- ]?level|lead experience|professional experience|formal (?:work )?experience|internship(?:s)?|enterprise experience|years? of experience|hands[- ]?on experience|employment history|work history|prior experience|experience with|work experience)\b/i;

const PROOF =
  /\b(portfolio|github|proof|evidence|deployed project|live demo|case study|measurable impact|track record|production(?:[- ]level)?|open[- ]?source contribution|team collaboration(?: evidence)?|collaboration evidence|teamwork(?: evidence)?|shipped project|demo link|repo link|mobile app portfolio|production(?:[- ]level)? (?:mobile )?(?:app )?portfolio)\b/i;

const ROLE_CONTEXT =
  /\b(remote organization(?: experience)?|remote work|language|fluency|german|english|location|relocat|work authori[sz]ation|visa|citizenship|time ?zone|on[- ]?site|hybrid|must be (?:based|located)|pixel[- ]?perfect|mobile ux|ui\/ux|communication|team environment|soft skills?|employer[- ]specific|culture fit|eligibility)\b/i;

/** Concrete tech/tool/language/platform signals. */
const TECHNICAL_SIGNAL =
  /\b(python|django|flask|fastapi|drf|django rest(?: framework)?|postgres(?:ql)?|mysql|mongodb|redis|sql|docker|kubernetes|k8s|git|github actions|ci\/?cd|rest(?:ful)?(?:\s+apis?)?|graphql|websocket|node(?:\.?js)?|express|nestjs|go(?:lang)?|goroutine|concurrency|channel|php|laravel|java|spring(?: boot)?|kotlin|swift|flutter|dart|react(?: native)?|next\.?js|vue|angular|typescript|javascript|aws|gcp|azure|terraform|ansible|nginx|linux|bash|migration(?:s)?|orm|prisma|hibernate|kafka|rabbitmq|grpc|microservices?|unit testing|integration testing|pytest|junit)\b/i;

export function toSpecRequirementKind(kind: RequirementKind): TechnicalRequirementKind {
  if (kind === "skill") return "technical_skill";
  if (kind === "evidence_gap") return "proof_gap";
  if (kind === "context_requirement") return "role_context";
  return "experience_gap";
}

export function isTechnicalSkillRequirement(value: string): boolean {
  return classifyRequirement(value).kind === "skill";
}

export function classifyRequirement(value: string): ClassifiedRequirement {
  const normalized = value.trim();
  if (!normalized) {
    return { value: "", kind: "context_requirement", label: "Role requirement" };
  }

  const tenureLike =
    /\b(\d+\+?\s*(?:years?|yrs?)|internship(?:s)?|formal (?:work )?experience|professional experience|years? of experience|employment history|work history|prior experience|hands[- ]?on experience)\b/i.test(
      normalized,
    );

  // Tenure / eligibility phrasing always wins.
  if (tenureLike) {
    return { value: normalized, kind: "experience_gap", label: "Experience gap" };
  }

  // "Experience with Django" → skill. "Experience with pixel-perfect UI" → context.
  if (/\bexperience with\b/i.test(normalized)) {
    if (TECHNICAL_SIGNAL.test(normalized)) {
      return { value: normalized, kind: "skill", label: "Skill" };
    }
    if (ROLE_CONTEXT.test(normalized) || /\bpixel[- ]?perfect\b|\bmobile ux\b|\bui\/ux\b/i.test(normalized)) {
      return {
        value: normalized,
        kind: "context_requirement",
        label: "Role requirement",
      };
    }
    return { value: normalized, kind: "experience_gap", label: "Experience gap" };
  }

  if (EXPERIENCE.test(normalized) && !TECHNICAL_SIGNAL.test(normalized)) {
    return { value: normalized, kind: "experience_gap", label: "Experience gap" };
  }

  if (PROOF.test(normalized)) {
    return { value: normalized, kind: "evidence_gap", label: "Evidence gap" };
  }
  if (ROLE_CONTEXT.test(normalized) && !TECHNICAL_SIGNAL.test(normalized)) {
    return {
      value: normalized,
      kind: "context_requirement",
      label: "Role requirement",
    };
  }
  // Pixel-perfect / mobile UX style phrases are role-context even when long.
  if (/\bpixel[- ]?perfect\b|\bmobile ux\b|\bui\/ux\b/i.test(normalized)) {
    return {
      value: normalized,
      kind: "context_requirement",
      label: "Role requirement",
    };
  }

  // Long sentence-like requirements are rarely learnable skills.
  if (
    normalized.split(/\s+/).length > 6 &&
    !TECHNICAL_SIGNAL.test(normalized)
  ) {
    return {
      value: normalized,
      kind: "context_requirement",
      label: "Role requirement",
    };
  }

  if (TECHNICAL_SIGNAL.test(normalized)) {
    return { value: normalized, kind: "skill", label: "Skill" };
  }

  // Allow short concrete tool/language labels that look technical.
  if (looksLikeConcreteSkill(normalized)) {
    return { value: normalized, kind: "skill", label: "Skill" };
  }

  return {
    value: normalized,
    kind: "context_requirement",
    label: "Role requirement",
  };
}

function looksLikeConcreteSkill(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[.!?]/.test(trimmed)) return false;
  if (
    /\b(experience|evidence|proof|portfolio|collaboration|communication|internship|senior|junior|team|remote|organization|fluency|authorization|eligibility)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  // Versioned/tool-like tokens: "C++", "C#", "Node.js", "Next.js", "CI/CD"
  if (/^[A-Za-z][A-Za-z0-9.+#/-]{0,24}$/.test(trimmed)) return true;
  // Multi-word only when every token looks tool-like (e.g. "Spring Boot").
  return words.every((word) => /^[A-Za-z][A-Za-z0-9.+#/-]{0,18}$/.test(word));
}

export function partitionRequirements(values: string[]): Record<RequirementKind, string[]> {
  const result: Record<RequirementKind, string[]> = {
    skill: [],
    experience_gap: [],
    evidence_gap: [],
    context_requirement: [],
  };
  const seen = new Set<string>();
  for (const raw of values) {
    const item = classifyRequirement(raw);
    const key = `${item.kind}:${item.value.toLowerCase()}`;
    if (!item.value || seen.has(key)) continue;
    seen.add(key);
    result[item.kind].push(item.value);
  }
  return result;
}
