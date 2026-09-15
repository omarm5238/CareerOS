import "dotenv/config";

process.env.CAREEROS_LINKEDIN_PROVIDER = "fixture";
process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY =
  process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim() ||
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
process.env.LINKEDIN_REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI?.trim() || "http://localhost:3000/api/linkedin/connection/callback";

import { chromium } from "playwright";
import { prisma } from "@/server/db/prisma";
import {
  completeLinkedinOAuthCallback,
  createLinkedinPublishingPlan,
  startLinkedinConnection,
} from "@/features/linkedin/server";

const BASE = "http://localhost:3000";

async function measure(page: import("playwright").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      href: location.href,
      innerWidth: window.innerWidth,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > doc.clientWidth,
      title: document.title,
      text: document.body.innerText.slice(0, 500),
    };
  });
}

async function login(page: import("playwright").Page) {
  const res = await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle", timeout: 60000 });
  const auth = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: {
      email: "m21-test@careeros.local",
      password: "Milestone21Test!",
      callbackURL: "/workspace",
    },
  });
  if (!auth.ok()) throw new Error(`Sign-in failed: ${auth.status()}`);
  const workspace = await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded", timeout: 60000 });
  return workspace?.status() ?? res?.status() ?? null;
}

async function ensureFixtureConnection(userId: string) {
  await prisma.linkedinOAuthAttempt.deleteMany({ where: { userId } });
  const start = await startLinkedinConnection(userId);
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  if (!state) throw new Error("Fixture OAuth state missing.");
  await completeLinkedinOAuthCallback(userId, { state, code: "fixture.SUCCESS" });
}

async function ensureReadyPlan(userId: string) {
  const existing = await prisma.linkedinPublishingPlan.findFirst({
    where: { userId, status: { in: ["READY", "SCHEDULED"] } },
    include: { linkedinPost: true },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  const profile = await prisma.linkedinGrowthProfile.findFirst({ where: { userId, status: "ACTIVE" } });
  if (!profile) throw new Error("No active LinkedIn strategy for headed QA.");
  const post = await prisma.linkedinPost.create({
    data: {
      userId,
      linkedinGrowthProfileId: profile.id,
      status: "READY",
      objective: "SHOW_EXPERTISE",
      format: "TEXT_POST",
    },
  });
  const revision = await prisma.linkedinPostRevision.create({
    data: {
      userId,
      linkedinPostId: post.id,
      revisionNumber: 1,
      source: "USER_EDITED",
      hook: "Headed QA frozen revision.",
      body: "CareerOS headed QA uses this exact frozen revision.",
      cta: "Compare notes if this work is relevant.",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
      qaStatus: "PASS",
    },
  });
  await prisma.linkedinPost.update({
    where: { id: post.id },
    data: { activeRevisionId: revision.id, status: "READY" },
  });
  const plan = await createLinkedinPublishingPlan(userId, post.id, {});
  return prisma.linkedinPublishingPlan.findFirstOrThrow({
    where: { id: plan.id },
    include: { linkedinPost: true },
  });
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  await ensureFixtureConnection(user.id);
  const plan = await ensureReadyPlan(user.id);
  const postId = plan.linkedinPostId;

  const routes = [
    "/workspace/linkedin",
    "/workspace/linkedin/settings",
    "/workspace/linkedin/calendar",
    `/workspace/linkedin/posts/${postId}`,
    `/workspace/linkedin/publish/${plan.id}`,
  ];

  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobilePage = await mobile.newPage();
  const desktopPage = await desktop.newPage();

  const signIn = await login(mobilePage);
  await login(desktopPage);

  const mobileResults = [];
  for (const route of routes) {
    const res = await mobilePage.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobilePage.waitForTimeout(800);
    mobileResults.push({ route, status: res?.status() ?? null, ...(await measure(mobilePage)) });
  }

  await desktopPage.goto(`${BASE}/workspace/linkedin`, { waitUntil: "domcontentloaded" });
  await desktopPage.waitForTimeout(600);
  const desktopOverview = await measure(desktopPage);
  const overviewConnected = await desktopPage.locator("text=LinkedIn connected").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/settings`, { waitUntil: "domcontentloaded" });
  const desktopSettings = await desktopPage.locator("text=LinkedIn Connection").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/calendar`, { waitUntil: "domcontentloaded" });
  const desktopCalendar = await desktopPage.locator("text=This Week").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/posts/${postId}`, { waitUntil: "domcontentloaded" });
  const desktopPost = await desktopPage.locator("text=Revision history").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/publish/${plan.id}`, { waitUntil: "domcontentloaded" });
  await desktopPage.waitForTimeout(800);
  const desktopPublish = await desktopPage.locator("text=Publishing Revision").count();
  const publishButton = desktopPage.getByRole("button", { name: "Publish to LinkedIn" });
  let desktopPublishClicked = false;
  if ((await publishButton.count()) > 0) {
    await publishButton.click();
    await desktopPage.waitForTimeout(1200);
    desktopPublishClicked = true;
  }
  const publishedLabel = await desktopPage.locator("text=Published to LinkedIn").count();

  await browser.close();
  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        signIn,
        mobileResults,
        desktop: {
          overview: desktopOverview.href,
          connected: overviewConnected > 0,
          settings: desktopSettings > 0,
          calendar: desktopCalendar > 0,
          post: desktopPost > 0,
          publish: desktopPublish > 0,
          publishClicked: desktopPublishClicked,
          publishedLabel: publishedLabel > 0,
        },
        overflowRoutes: mobileResults.filter((item) => item.overflow).map((item) => item.route),
        ok: mobileResults.every((item) => item.status === 200 && !item.overflow),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
