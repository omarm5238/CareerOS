import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { prepareApplicationPackageBatch } from "@/features/application-packages/server";
import { runJobDiscovery } from "@/features/jobs/discovery/lib/run-job-discovery";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch { /* empty body */ }

  try {
    const result = await runJobDiscovery(session.user.id, { force });
    const profile = await prisma.jobDiscoveryProfile.findUnique({
      where: { userId: session.user.id },
      select: { applicationPreparationMode: true },
    });
    if (profile?.applicationPreparationMode === "AUTO_PREPARE") {
      const prepared = await prepareApplicationPackageBatch(session.user.id, { limit: 5 });
      return NextResponse.json({ ...result, autoPrepared: prepared });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discovery failed.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
