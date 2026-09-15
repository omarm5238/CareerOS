import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { completeLinkedinOAuthCallback, LinkedinIntegrationError } from "@/features/linkedin/server";
import { auth } from "@/server/auth";

const SETTINGS = "/workspace/linkedin/settings";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (!session) {
    const signIn = new URL("/sign-in", url.origin);
    signIn.searchParams.set("callbackURL", SETTINGS);
    return NextResponse.redirect(signIn);
  }

  if (providerError) {
    return NextResponse.redirect(safeRedirect(url.origin, "denied"));
  }

  try {
    await completeLinkedinOAuthCallback(session.user.id, { state, code });
    return NextResponse.redirect(safeRedirect(url.origin, "connected"));
  } catch (error) {
    const codeName = error instanceof LinkedinIntegrationError ? error.code : "callback_failed";
    return NextResponse.redirect(safeRedirect(url.origin, codeName));
  }
}

function safeRedirect(origin: string, result: string) {
  const target = new URL(SETTINGS, origin);
  target.searchParams.set("linkedin", result);
  return target;
}
