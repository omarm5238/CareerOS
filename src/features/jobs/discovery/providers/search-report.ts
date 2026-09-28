export type ProviderSearchReport = {
  status: "success" | "partial" | "failed" | "unsupported_target" | "rate_limited";
  requestsMade: number;
  boardsQueried: number;
  fetched: number;
  invalidRemoved: number;
};
