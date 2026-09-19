import "dotenv/config";

import { chromium } from "playwright";
import { prisma } from "@/server/db/prisma";
import { finalizeWeeklyReview, generateWeeklyReview } from "@/features/weekly-review/server";
import { getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/server";

const BASE = "http://localhost:3000";

async function measure(page: import("playwright").Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      href: location.href,
      innerWidth: window.innerWidth,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
      title: document.title,
      text: document.body.innerText.slice(0, 900),
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

async function clickHistoryToDetail(
  page: import("playwright").Page,
  reviewId: string,
  expected: { weekLabel: string; score: number | null; band: string | null },
) {
  const expectedPath = `/workspace/review/${reviewId}`;
  await page.goto(`${BASE}/workspace/review`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const link = page.locator(`[data-testid="history-review-link"][data-review-id="${reviewId}"]`);
  await link.waitFor({ state: "visible", timeout: 20000 });
  await link.scrollIntoViewIfNeeded();
  const href = await link.getAttribute("href");
  if (href !== expectedPath) {
    throw new Error(`History link href was ${href}, expected ${expectedPath}`);
  }
  await Promise.all([
    page.waitForURL((url) => url.pathname === expectedPath, { timeout: 30000 }),
    link.click(),
  ]);
  await page.getByTestId("momentum-hero").waitFor({ timeout: 15000 });
  const snapshot = await measure(page);
  const text = snapshot.text;
  if (!snapshot.href.includes(expectedPath)) {
    throw new Error(`History click stayed on ${snapshot.href}; expected ${expectedPath}`);
  }
  if (!text.includes("Finalized")) throw new Error("Historical detail is missing the Finalized badge.");
  if (!text.includes(expected.weekLabel)) {
    throw new Error(`Historical detail is missing stored week label ${expected.weekLabel}.`);
  }
  if (expected.score !== null && !text.includes(`${expected.score} / 100`)) {
    throw new Error(`Historical detail is missing stored Momentum score ${expected.score}.`);
  }
  if (expected.band && !text.includes(expected.band)) {
    throw new Error(`Historical detail is missing stored Momentum band ${expected.band}.`);
  }
  if ((await page.getByTestId("refresh-review").count()) > 0) {
    throw new Error("Finalized historical detail still shows Refresh.");
  }
  const componentCount = await page.locator("[data-testid^=component-]").count();
  if (componentCount < 5) throw new Error("Historical detail is missing frozen component snapshot.");
  if ((await page.getByTestId("next-week").count()) === 0) {
    throw new Error("Historical detail is missing recommendations/content.");
  }
  return snapshot;
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  await getOrCreateDailyRoadmapPreference(user.id);
  const now = new Date();
  await generateWeeklyReview(user.id, {}, { now });
  let past = await generateWeeklyReview(user.id, { weekStartLocalDate: "2026-09-07" }, { now });
  if (past.status === "DRAFT") {
    past = await finalizeWeeklyReview(user.id, past.id, now);
  }
  const pastExpected = {
    weekLabel: past.weekLabel,
    score: past.overallMomentumScore,
    band: past.overallMomentumBand,
  };

  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });
  try {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const mobilePage = await mobile.newPage();
    const desktopPage = await desktop.newPage();

    const signIn = await login(desktopPage);
    await login(mobilePage);

    await desktopPage.goto(`${BASE}/workspace/review`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await desktopPage.waitForTimeout(800);
    const generate = desktopPage.getByTestId("generate-review");
    if ((await generate.count()) > 0) {
      await generate.click();
      await desktopPage.waitForTimeout(1500);
    }
    const refresh = desktopPage.getByTestId("refresh-review");
    if ((await refresh.count()) > 0) await refresh.click();
    await desktopPage.waitForTimeout(800);
    const adopt = desktopPage.getByTestId("adopt-recommendation").first();
    if ((await adopt.count()) > 0) {
      await adopt.click();
      await desktopPage.getByText("Adopted for next-week focus").first().waitFor({ timeout: 15000 });
    }
    const dismiss = desktopPage.getByTestId("dismiss-recommendation");
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click({ force: false, timeout: 15000 });
      await desktopPage.waitForTimeout(800);
    }
    const desktopReview = await measure(desktopPage);
    const hasMomentum = (await desktopPage.getByTestId("momentum-hero").count()) > 0;
    const hasHistory = (await desktopPage.getByTestId("review-history").count()) > 0;

    const desktopHistoryClicks: Array<{ attempt: number; href: string }> = [];
    let desktopDetail: Awaited<ReturnType<typeof measure>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      desktopDetail = await clickHistoryToDetail(desktopPage, past.id, pastExpected);
      desktopHistoryClicks.push({ attempt, href: new URL(desktopDetail.href).pathname });
    }
    const desktopHistorySuccesses = desktopHistoryClicks.filter(
      (item) => item.href === `/workspace/review/${past.id}`,
    ).length;

    await mobilePage.goto(`${BASE}/workspace/review`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobilePage.waitForTimeout(800);
    if ((await mobilePage.getByTestId("generate-review").count()) > 0) {
      await mobilePage.getByTestId("generate-review").click();
      await mobilePage.waitForTimeout(1500);
    }
    const mobileReview = await measure(mobilePage);
    const adoptMobile = (await mobilePage.getByTestId("adopt-recommendation").count()) > 0;
    const historyMobile = (await mobilePage.getByTestId("review-history").count()) > 0;
    const mobileDetail = await clickHistoryToDetail(mobilePage, past.id, pastExpected);

    const overflow = Boolean(mobileReview.overflow || mobileDetail.overflow);
    const ok =
      signIn === 200 &&
      hasMomentum &&
      hasHistory &&
      desktopHistorySuccesses === 3 &&
      mobileDetail.href.includes(`/workspace/review/${past.id}`) &&
      !overflow;
    console.log(
      JSON.stringify(
        {
          signIn,
          desktopReview,
          hasMomentum,
          hasHistory,
          desktopHistoryClicks,
          desktopHistorySuccesses,
          expectedHistoryPath: `/workspace/review/${past.id}`,
          desktopDetail,
          mobileReview,
          mobileDetail,
          adoptMobile,
          historyMobile,
          overflow,
          ok,
        },
        null,
        2,
      ),
    );
    if (!ok) throw new Error("M27 headed history navigation QA failed.");
  } finally {
    await browser.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
