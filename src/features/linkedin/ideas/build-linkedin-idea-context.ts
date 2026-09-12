import { buildLinkedinCareerContext } from "../context/build-linkedin-career-context";
import { getLinkedinStrategy } from "../strategy/get-linkedin-strategy";

export async function buildLinkedinIdeaContext(userId: string) {
  const [career, strategy] = await Promise.all([
    buildLinkedinCareerContext(userId),
    getLinkedinStrategy(userId),
  ]);
  return { career, strategy };
}
