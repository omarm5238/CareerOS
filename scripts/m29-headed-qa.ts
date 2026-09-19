import "dotenv/config";

import { chromium } from "playwright";
import { prisma } from "@/server/db/prisma";
import { generateTodayRoadmap, getOrCreateDailyRoadmapPreference } from "@/features/daily-roadmap/server";
import { generateWeeklyReview } from "@/features/weekly-review/server";
import { createUserDeclaredMemory, getOrCreateCareerMemoryPreference, refreshCareerMemory } from "@/features/career-memory/server";

const BASE = "http://localhost:3000";

const CORE_ROUTES = [
  "/workspace/today",
  "/workspace/review",
  "/workspace/memory",
  "/workspace/jobs",
  "/workspace/applications",
  "/workspace/resume",
  "/workspace/linkedin",
  "/workspace/settings",
] as const;

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
      text: document.body.innerText.slice(0, 1600),
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

async function seedPhase2Journey(userId: string) {
  await getOrCreateDailyRoadmapPreference(userId);
  await getOrCreateCareerMemoryPreference(userId);
  const job =
    (await prisma.jobPosting.findFirst({ where: { userId, title: "M29 Headed Backend Engineer" } })) ??
    (await prisma.jobPosting.create({
      data: {
        userId,
        title: "M29 Headed Backend Engineer",
        company: "CareerOS Labs",
        description: "Go PostgreSQL system design. Remote.",
      },
    }));
  const application =
    (await prisma.application.findFirst({ where: { userId, jobPostingId: job.id } })) ??
    (await prisma.application.create({
      data: {
        userId,
        jobPostingId: job.id,
        status: "DRAFT",
        source: "MANUAL",
        contextSnapshotJson: { job: { title: job.title, company: "CareerOS Labs" } },
      },
    }));
  const draft =
    (await prisma.communicationDraft.findFirst({ where: { userId, applicationId: application.id } })) ??
    (await prisma.communicationDraft.create({
      data: {
        userId,
        applicationId: application.id,
        type: "FOLLOW_UP",
        status: "READY",
      },
    }));
  await generateTodayRoadmap(userId).catch(() => undefined);
  await generateWeeklyReview(userId, {}).catch(() => undefined);
  await refreshCareerMemory(userId, { mode: "ON_DEMAND" }).catch(() => undefined);
  await createUserDeclaredMemory(userId, { category: "skill", value: "PostgreSQL" }).catch(() => undefined);
  return { job, application, draft };
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "m21-test@careeros.local" } });
  if (!user) throw new Error("m21-test@careeros.local is missing.");
  const seeded = await seedPhase2Journey(user.id);

  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const desktopPage = await desktop.newPage();
    const mobilePage = await mobile.newPage();

    const signIn = await login(desktopPage);
    await login(mobilePage);

    await desktopPage.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const workspaceNav = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(seeded.job.id)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await desktopPage.waitForTimeout(800);
    if ((await desktopPage.getByTestId("analyze-opportunity").count()) > 0) {
      await desktopPage.getByTestId("analyze-opportunity").click();
      await desktopPage.waitForTimeout(2500);
    }
    const jobsSnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/jobs/apply-now`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const applyNowSnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/applications/${seeded.application.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const markApplied = desktopPage.getByRole("button", { name: "Mark Applied" });
    await markApplied.waitFor({ state: "visible", timeout: 15000 }).catch(() => undefined);
    if ((await markApplied.count()) > 0 && (await markApplied.isEnabled())) {
      await markApplied.click();
      await desktopPage.getByText("Application stage updated.").waitFor({ timeout: 15000 }).catch(() => undefined);
    }
    if ((await prisma.application.findFirst({ where: { id: seeded.application.id, userId: user.id } }))?.status !== "APPLIED") {
      const applied = await desktopPage.request.post(`${BASE}/api/applications/${seeded.application.id}/status`, {
        data: { status: "APPLIED" },
      });
      if (!applied.ok()) {
        throw new Error(`Could not mark application APPLIED: ${applied.status()}`);
      }
    }
    await desktopPage.goto(`${BASE}/workspace/applications`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const trackerSnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/communications/${seeded.draft.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const commsSnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/linkedin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const linkedinSnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/today`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const generateToday = desktopPage.getByTestId("generate-today");
    if ((await generateToday.count()) > 0) {
      await generateToday.click();
      await desktopPage.waitForTimeout(1500);
    }
    const complete = desktopPage.getByRole("button", { name: "Complete" }).first();
    if ((await complete.count()) > 0 && (await complete.isEnabled())) {
      await complete.click();
      await desktopPage.waitForTimeout(1800);
    }
    const todaySnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/review`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const generateReview = desktopPage.getByTestId("generate-review");
    if ((await generateReview.count()) > 0) {
      await generateReview.click();
      await desktopPage.waitForTimeout(1800);
    }
    const finalize = desktopPage.getByTestId("finalize-review");
    if ((await finalize.count()) > 0 && (await finalize.isEnabled())) {
      await finalize.click();
      const confirm = desktopPage.getByTestId("confirm-finalize");
      if ((await confirm.count()) > 0) await confirm.click();
      await desktopPage.waitForTimeout(1200);
    }
    const reviewSnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/memory`, { waitUntil: "domcontentloaded", timeout: 60000 });
    if ((await desktopPage.getByTestId("refresh-memory").count()) > 0) {
      await desktopPage.getByTestId("refresh-memory").click();
      await desktopPage.waitForTimeout(1200);
    }
    const memorySnap = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/today`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const todayAfterMemory = await measure(desktopPage);

    await desktopPage.goto(`${BASE}/workspace/settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
    const settingsSnap = await measure(desktopPage);
    const exportRes = await desktopPage.request.get(`${BASE}/api/settings/export`);
    const exportPayload = (await exportRes.json().catch(() => null)) as { schemaVersion?: string } | null;
    let exportOk = exportRes.ok() && exportPayload?.schemaVersion === "m29.1";
    if ((await desktopPage.getByTestId("export-workspace-data").count()) > 0) {
      await desktopPage.getByTestId("export-workspace-data").scrollIntoViewIfNeeded();
      await desktopPage.getByTestId("export-workspace-data").click();
      await desktopPage.getByText("Export downloaded.").waitFor({ timeout: 20000 }).catch(() => undefined);
      exportOk = exportOk || (await desktopPage.getByText("Export downloaded.").count()) > 0;
    }

    const mobileMeasures = [];
    for (const route of CORE_ROUTES) {
      await mobilePage.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await mobilePage.waitForTimeout(500);
      mobileMeasures.push(await measure(mobilePage));
    }

    const overflow =
      jobsSnap.overflow ||
      trackerSnap.overflow ||
      todaySnap.overflow ||
      reviewSnap.overflow ||
      memorySnap.overflow ||
      settingsSnap.overflow ||
      mobileMeasures.some((item) => item.overflow);

    const e2e = {
      jobs: jobsSnap.href.includes("/workspace/jobs"),
      tracker: trackerSnap.href.includes("/workspace/applications"),
      linkedin: linkedinSnap.href.includes("/workspace/linkedin"),
      today: todaySnap.href.includes("/workspace/today"),
      review: reviewSnap.href.includes("/workspace/review") && (reviewSnap.text.includes("Momentum") || reviewSnap.text.includes("Weekly Review")),
      memory: memorySnap.href.includes("/workspace/memory"),
      settings: settingsSnap.href.includes("/workspace/settings") && settingsSnap.text.includes("Data & Export"),
      exportOk,
    };

    const ok =
      signIn === 200 &&
      workspaceNav.href.includes("/workspace") &&
      e2e.jobs &&
      e2e.tracker &&
      e2e.today &&
      e2e.review &&
      e2e.memory &&
      e2e.settings &&
      e2e.exportOk &&
      !overflow;

    console.log(
      JSON.stringify(
        {
          signIn,
          e2e,
          overflow,
          desktop: { jobsSnap, applyNowSnap, trackerSnap, commsSnap, linkedinSnap, todaySnap, reviewSnap, memorySnap, todayAfterMemory, settingsSnap },
          mobile: mobileMeasures,
          ok,
        },
        null,
        2,
      ),
    );
    if (!ok) throw new Error("M29 headed Phase-2 QA failed.");
  } finally {
    await browser.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
