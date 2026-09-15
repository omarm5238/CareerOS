import { getLinkedinProviderMode } from "../config";
import { FixtureLinkedinApiClient } from "./fixture-client";
import { OfficialLinkedinApiClient } from "./official-client";
import type { LinkedinApiClient } from "./types";

let fixtureSingleton: FixtureLinkedinApiClient | null = null;
let officialSingleton: OfficialLinkedinApiClient | null = null;

export function getLinkedinApiClient(): LinkedinApiClient {
  if (getLinkedinProviderMode() === "fixture") {
    fixtureSingleton ??= new FixtureLinkedinApiClient();
    return fixtureSingleton;
  }
  officialSingleton ??= new OfficialLinkedinApiClient();
  return officialSingleton;
}

export { FixtureLinkedinApiClient, OfficialLinkedinApiClient };
export type { LinkedinApiClient };
