import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/features/onboarding";
import { auth } from "@/server/auth";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return <OnboardingFlow />;
}
