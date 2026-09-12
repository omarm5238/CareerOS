import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "@/server/db/prisma";

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
      text: document.body.innerText.slice(0, 400),
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

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  const post = await prisma.linkedinPost.findFirst({
    where: { userId: user.id, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
  });
  if (!post) throw new Error("No LinkedIn post available for headed QA.");

  const routes = [
    "/workspace/linkedin",
    "/workspace/linkedin/strategy",
    "/workspace/linkedin/ideas",
    `/workspace/linkedin/posts/${post.id}`,
    "/workspace/linkedin/calendar",
    "/workspace/linkedin/insights",
    "/workspace/linkedin/drafts",
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
  await desktopPage.goto(`${BASE}/workspace/linkedin/strategy`, { waitUntil: "domcontentloaded" });
  const desktopStrategy = await desktopPage.locator("text=Primary goal").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/ideas`, { waitUntil: "domcontentloaded" });
  const desktopIdeas = await desktopPage.locator("text=What should you post next?").count();
  await desktopPage.goto(`${BASE}${routes[3]}`, { waitUntil: "domcontentloaded" });
  const desktopPost = await desktopPage.locator("text=Revision history").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/calendar`, { waitUntil: "domcontentloaded" });
  const desktopCalendar = await desktopPage.locator("text=This Week").count();
  await desktopPage.goto(`${BASE}/workspace/linkedin/insights`, { waitUntil: "domcontentloaded" });
  const desktopInsights = await desktopPage.locator("text=manual until M25B").count();

  await browser.close();
  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        signIn,
        mobileResults,
        desktop: {
          overview: desktopOverview.href,
          strategy: desktopStrategy > 0,
          ideas: desktopIdeas > 0,
          post: desktopPost > 0,
          calendar: desktopCalendar > 0,
          insights: desktopInsights > 0,
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
