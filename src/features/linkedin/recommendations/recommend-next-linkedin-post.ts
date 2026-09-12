import { recommendNextLinkedinIdeas } from "./recommend-next-linkedin-ideas";
import { getLinkedinContentBalance } from "./get-linkedin-content-balance";

export async function recommendNextLinkedinPost(userId: string) {
  const [ideas, balance] = await Promise.all([
    recommendNextLinkedinIdeas(userId),
    getLinkedinContentBalance(userId),
  ]);
  return {
    recommendation: ideas[0] ?? null,
    top: ideas,
    balance,
  };
}
