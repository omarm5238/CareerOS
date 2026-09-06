import { normalizeToken, sha256 } from "./hash";

export function buildOpportunityContextFingerprint(input: {
  title: string;
  company: string;
  description: string;
  location: string | null;
  jobUrl: string | null;
  roleTargets: string[];
  workModes: string[];
  evidenceSignal: string;
}): string {
  return sha256(
    [
      normalizeToken(input.title),
      normalizeToken(input.company),
      normalizeToken(input.description.slice(0, 4000)),
      normalizeToken(input.location ?? ""),
      normalizeToken(input.jobUrl ?? ""),
      input.roleTargets.map(normalizeToken).sort().join(","),
      input.workModes.map(normalizeToken).sort().join(","),
      normalizeToken(input.evidenceSignal),
    ].join("|"),
  );
}
