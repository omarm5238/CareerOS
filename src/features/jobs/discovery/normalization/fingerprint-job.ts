import { createHash } from "crypto";
import { normalizeTitle, normalizeCompany } from "./normalize-text";

export function fingerprintJob(
  company: string,
  title: string,
  countryCode: string | null,
  location: string | null,
): string {
  const normCompany = normalizeCompany(company);
  const normTitle = normalizeTitle(title);
  const normCountry = (countryCode ?? "").toLowerCase().trim();
  const normLocation = (location ?? "").toLowerCase().trim();

  const input = [normCompany, normTitle, normCountry, normLocation].join("|");
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}
