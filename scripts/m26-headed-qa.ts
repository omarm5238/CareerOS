import "dotenv/config";

import { chromium } from "playwright";
import { prisma } from "@/server/db/prisma";
import { generateTodayRoadmap, getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/server";
import { transitionApplicationStatus } from "@/features/applications/server";

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
      text: document.body.innerText.slice(0, 800),
    };
  });
}

async function addCareerAction(
  page: import("playwright").Page,
  title: string,
  minutes?: string,
) {
  await page.getByRole("button", { name: "Add Career Action" }).click();
  await page.getByTestId("custom-action-minutes").waitFor({ state: "visible" });
  await page.getByTestId("custom-action-title").fill(title);
  if (minutes) {
    await page.getByTestId("custom-action-minutes").selectOption(minutes);
  }
  await page.getByTestId("custom-action-submit").click();
  await page.getByTestId("custom-action-title").waitFor({ state: "hidden", timeout: 15000 });
  await page.getByRole("heading", { name: title }).waitFor({ state: "visible", timeout: 15000 });
  const expected = `${minutes ?? "15"} min`;
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
  const estimate = ((await card.getByTestId("action-minutes").textContent()) ?? "").trim();
  if (estimate !== expected) {
    throw new Error(`Expected ${title} to render ${expected}, got ${estimate}`);
  }
  return { estimate, selectVisible: true };
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
  await getOrCreateDailyRoadmapPreference(user.id);
  await generateTodayRoadmap(user.id);

  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });
  try {
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobilePage = await mobile.newPage();
  const desktopPage = await desktop.newPage();

  const signIn = await login(desktopPage);
  await login(mobilePage);

  await desktopPage.goto(`${BASE}/workspace/today`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await desktopPage.waitForTimeout(800);
  const generate = desktopPage.getByRole("button", { name: "Generate Today" });
  if ((await generate.count()) > 0) {
    await generate.click();
    await desktopPage.waitForTimeout(1500);
  }
  const settings = desktopPage.getByRole("button", { name: "Settings" });
  await settings.click();
  await desktopPage.waitForTimeout(400);
  await desktopPage.getByRole("button", { name: "Cancel" }).click();

  const complete = desktopPage.getByRole("button", { name: "Complete" }).first();
  if ((await complete.count()) > 0 && (await complete.isEnabled())) {
    await complete.click();
    await desktopPage.waitForTimeout(1800);
  }
  const defer = desktopPage.getByRole("button", { name: "Defer" }).first();
  if ((await defer.count()) > 0 && (await defer.isEnabled())) {
    await defer.click();
    const tomorrow = desktopPage.getByRole("button", { name: "Tomorrow" });
    if ((await tomorrow.count()) > 0) await tomorrow.click();
    await desktopPage.waitForTimeout(1500);
  }
  const skip = desktopPage.getByRole("button", { name: "Skip" }).first();
  if ((await skip.count()) > 0 && (await skip.isEnabled())) {
    await skip.click();
    const noTime = desktopPage.getByRole("button", { name: "No time" });
    if ((await noTime.count()) > 0) await noTime.click();
    await desktopPage.waitForTimeout(1500);
  }
  const stamp = Date.now();
  const desktopCustom = await addCareerAction(
    desktopPage,
    `Prepare talking points for a hiring manager conversation ${stamp}`,
    "30",
  );
  const desktopNoEstimate = await addCareerAction(
    desktopPage,
    `Capture a title-only career follow-up ${stamp}`,
  );
  const refresh = desktopPage.getByRole("button", { name: "Refresh Today" });
  if ((await refresh.count()) > 0) await refresh.click();
  await desktopPage.waitForTimeout(1000);
  const desktopToday = await measure(desktopPage);
  const hasTop = (await desktopPage.locator("text=Top Priorities").count()) > 0 || (await desktopPage.locator("text=clear on urgent").count()) > 0;
  const hasStreak = (await desktopPage.locator("text=Career Streak").count()) > 0;
  const hasCompleted = (await desktopPage.locator("text=Completed Today").count()) > 0;

  const linkedApply = await prisma.dailyRoadmapAction.findFirst({
    where: { userId: user.id, type: "JOB_APPLY", sourceEntityType: "APPLICATION", status: { in: ["PLANNED", "IN_PROGRESS"] } },
  });
  let domainSync = null as null | Record<string, unknown>;
  const roadmap = await prisma.dailyRoadmap.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const application =
    linkedApply?.sourceEntityId
      ? await prisma.application.findFirst({ where: { id: linkedApply.sourceEntityId, userId: user.id } })
      : await prisma.application.create({
          data: { userId: user.id, status: "DRAFT", contextSnapshotJson: {} },
        });
  const actionId =
    linkedApply?.id ??
    (
      await prisma.dailyRoadmapAction.create({
        data: {
          userId: user.id,
          dailyRoadmapId: roadmap!.id,
          type: "JOB_APPLY",
          origin: "SYSTEM_GENERATED",
          sourceEntityType: "APPLICATION",
          sourceEntityId: application!.id,
          title: "Apply to headed QA company",
          priorityScore: 80,
          priorityBand: "HIGH",
          estimatedMinutes: 30,
          status: "PLANNED",
          isMeaningful: true,
          isActionable: true,
          sortOrder: 40,
          fingerprint: `JOB_APPLY:APPLICATION:${application!.id}:headed`,
          contextSnapshotJson: {},
        },
      })
    ).id;
  if (application && application.status === "DRAFT") {
    await transitionApplicationStatus({ userId: user.id, applicationId: application.id, toStatus: "APPLIED" });
    await desktopPage.goto(`${BASE}/workspace/today`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(800);
    const refreshedAction = await prisma.dailyRoadmapAction.findUnique({ where: { id: actionId } });
    domainSync = {
      applicationStatus: "APPLIED",
      actionStatus: refreshedAction?.status,
      completionSource: refreshedAction?.completionSource,
    };
  }

  await mobilePage.goto(`${BASE}/workspace/today`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await mobilePage.waitForTimeout(800);
  const generateMobile = mobilePage.getByRole("button", { name: "Generate Today" });
  if ((await generateMobile.count()) > 0) {
    await generateMobile.click();
    await mobilePage.waitForTimeout(1500);
  }
  const mobileStamp = `${stamp}-m`;
  const mobileCustom = await addCareerAction(
    mobilePage,
    `Draft a 30-minute interview story bank ${mobileStamp}`,
    "30",
  );
  const mobileNoEstimate = await addCareerAction(
    mobilePage,
    `Log a title-only career action from mobile ${mobileStamp}`,
  );
  const mobileToday = await measure(mobilePage);
  await mobilePage.getByRole("button", { name: "Settings" }).click();
  await mobilePage.waitForTimeout(400);
  const mobileSettings = await measure(mobilePage);
  const settingsUsable = (await mobilePage.getByRole("button", { name: "Save" }).count()) > 0;

  const overflow = Boolean(mobileToday.overflow);
  console.log(
    JSON.stringify(
      {
        signIn,
        desktopToday,
        hasTop,
        hasStreak,
        hasCompleted,
        desktopCustom,
        desktopNoEstimate,
        domainSync,
        mobileToday,
        mobileCustom,
        mobileNoEstimate,
        mobileSettings,
        settingsUsable,
        overflow,
        ok:
          signIn === 200 &&
          hasStreak &&
          !overflow &&
          settingsUsable &&
          desktopCustom.estimate === "30 min" &&
          desktopNoEstimate.estimate === "15 min" &&
          mobileCustom.estimate === "30 min" &&
          mobileNoEstimate.estimate === "15 min",
      },
      null,
      2,
    ),
  );
  } finally {
    await browser.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
