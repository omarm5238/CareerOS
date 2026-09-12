import { NextResponse } from "next/server";

import { isGrowthGoal } from "@/features/linkedin/lib/permissions";
import {
  generateLinkedinStrategy,
  getLinkedinStrategy,
  handleLinkedinError,
  readOptionalJsonBody,
  requireLinkedinUser,
  updateLinkedinStrategy,
} from "@/features/linkedin/server";

export async function GET() {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ strategy: await getLinkedinStrategy(auth.userId) });
  } catch (error) {
    return handleLinkedinError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readOptionalJsonBody(request);
    const primaryGoal = isGrowthGoal(body.primaryGoal) ? body.primaryGoal : undefined;
    return NextResponse.json(await generateLinkedinStrategy(auth.userId, { primaryGoal }));
  } catch (error) {
    return handleLinkedinError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireLinkedinUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await readOptionalJsonBody(request);
    return NextResponse.json(await updateLinkedinStrategy(auth.userId, body));
  } catch (error) {
    return handleLinkedinError(error);
  }
}
