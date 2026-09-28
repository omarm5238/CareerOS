export type CuratedBoard = {
  company: string;
  slug: string;
  countries: string[];
  priority: number;
  enabled: boolean;
};

export const LEVER_BOARDS: CuratedBoard[] = [
  { company: "iyzico", slug: "iyzico", countries: ["TR"], priority: 1, enabled: true },
  { company: "Trendyol", slug: "trendyol", countries: ["TR"], priority: 2, enabled: true },
  { company: "Insider", slug: "insiderone", countries: ["TR"], priority: 3, enabled: true },
];

export const GREENHOUSE_BOARDS: CuratedBoard[] = [
  { company: "Dream Games", slug: "dreamgames", countries: ["TR"], priority: 1, enabled: true },
  { company: "N26", slug: "n26", countries: ["DE"], priority: 1, enabled: true },
  { company: "Adyen", slug: "adyen", countries: ["NL", "DE"], priority: 1, enabled: true },
  { company: "HelloFresh", slug: "hellofresh", countries: ["DE", "NL"], priority: 2, enabled: true },
  { company: "Wolt", slug: "wolt", countries: ["DE"], priority: 3, enabled: true },
];

export function selectBoards(boards: CuratedBoard[], countries: string[], limit: number): CuratedBoard[] {
  const wanted = new Set(countries.map((country) => country.toUpperCase()));
  if (wanted.size === 0) return [];
  return boards
    .filter((board) => board.enabled && board.countries.some((country) => wanted.has(country)))
    .sort((a, b) => a.priority - b.priority || a.company.localeCompare(b.company))
    .slice(0, limit);
}
