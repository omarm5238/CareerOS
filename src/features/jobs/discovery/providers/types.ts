import type { ProviderJobResult, ProviderSearchRequest, DiscoveryProviderName, ProviderAttribution } from "../types";

export interface JobDiscoveryProvider {
  provider: DiscoveryProviderName;
  isConfigured(): boolean;
  getStatus(): "available" | "not_configured" | "unavailable";
  search(request: ProviderSearchRequest): Promise<ProviderJobResult[]>;
  getAttribution(job: ProviderJobResult): ProviderAttribution;
}
