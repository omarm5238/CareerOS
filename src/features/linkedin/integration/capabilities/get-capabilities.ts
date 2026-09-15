import { capabilityList } from "./resolve-capabilities";
import { currentCapabilities, getLinkedinConnectionRecord } from "../connection/lifecycle";

export async function getLinkedinCapabilities(userId: string) {
  const connection = await getLinkedinConnectionRecord(userId);
  return { capabilities: capabilityList(currentCapabilities(connection)) };
}
