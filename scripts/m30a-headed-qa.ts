import "dotenv/config";

import { chromium, type Page } from "playwright";
import { prisma } from "@/server/db/prisma";

const BASE = "http://localhost:3000";
const DESCRIPTION =
  "M30A reliability fixture. Backend engineer role focused on Node.js APIs, PostgreSQL, and careful mutation handling. This posting is disposable test data only.";

async function login(page: Page) {
  const auth = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: {
      email: "m21-test@careeros.local",
      password: "Milestone21Test!",
    },
  });
  return auth.status();
}

async function createJob(page: Page, title: string) {
  const response = await page.request.post(`${BASE}/api/jobs`, {
    data: {
      title,
      company: "M30A Labs",
      location: "Remote",
      description: DESCRIPTION,
      source: "M30A",
    },
  });
  const body = (await response.json()) as { id?: string; message?: string };
  if (!response.ok() || !body.id) {
    throw new Error(`Could not create ${title}: ${response.status()} ${body.message ?? ""}`);
  }
  return body.id;
}

async function openDeleteConfirm(page: Page) {
  const confirm = page.getByRole("button", { name: "Confirm delete" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await confirm.isVisible().catch(() => false)) return;
    await page.getByRole("button", { name: "Delete job" }).click();
    try {
      await confirm.waitFor({ state: "visible", timeout: 4000 });
      return;
    } catch {
      // A click before hydration is dropped when the client tree mounts.
    }
  }
  throw new Error("Confirm delete did not appear");
}

async function deleteThroughUi(page: Page, jobId: string, title: string) {
  await page.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(jobId)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: title, level: 2 }).waitFor({ timeout: 20000 });
  await openDeleteConfirm(page);
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page.getByRole("button", { name: "Deleting…" }).waitFor({ state: "hidden", timeout: 20000 });
  await page.getByRole("link", { name: new RegExp(title) }).waitFor({ state: "hidden", timeout: 20000 });
  const stuck = await page.getByRole("button", { name: "Deleting…" }).count();
  if (stuck > 0) throw new Error(`Deleting state stuck after ${title}`);
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const evidence: Record<string, unknown> = {};

  try {
    const signIn = await login(page);
    evidence.signIn = signIn;
    if (signIn !== 200) throw new Error(`Sign-in failed: ${signIn}`);

    const alpha = await createJob(page, "M30A Headed Alpha");
    const beta = await createJob(page, "M30A Headed Beta");
    const gamma = await createJob(page, "M30A Headed Gamma");
    const failureJob = await createJob(page, "M30A Headed Failure");
    const repeatJob = await createJob(page, "M30A Headed Repeat");

    await deleteThroughUi(page, alpha, "M30A Headed Alpha");
    evidence.firstDelete = "idle";
    await deleteThroughUi(page, beta, "M30A Headed Beta");
    evidence.secondDelete = "idle-without-refresh";
    await deleteThroughUi(page, gamma, "M30A Headed Gamma");
    evidence.thirdDelete = "idle-without-refresh";

    await page.reload({ waitUntil: "domcontentloaded" });
    const textAfterReload = await page.locator("body").innerText();
    evidence.persisted =
      !textAfterReload.includes("M30A Headed Alpha") &&
      !textAfterReload.includes("M30A Headed Beta") &&
      !textAfterReload.includes("M30A Headed Gamma");
    evidence.otherJobIntact = textAfterReload.includes("Backend Developer");
    if (!evidence.persisted) throw new Error("Deleted jobs returned after reload");
    if (!evidence.otherJobIntact) throw new Error("Unrelated saved job disappeared");

    let failureHits = 0;
    await page.route(`**/api/jobs/${failureJob}`, async (route) => {
      if (route.request().method() === "DELETE") {
        failureHits += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Could not delete job. Please try again." }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(failureJob)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "M30A Headed Failure", level: 2 }).waitFor();
    await openDeleteConfirm(page);
    await page.getByRole("button", { name: "Confirm delete" }).click();
    const failureAlert = page.getByRole("alert").filter({ hasText: "Could not delete" });
    await failureAlert.waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Deleting…" }).waitFor({ state: "hidden", timeout: 15000 });
    const alertText = await failureAlert.innerText();
    const pendingAfterFailure = await page.getByRole("button", { name: "Deleting…" }).count();
    const stillVisible = await page.getByRole("heading", { name: "M30A Headed Failure", level: 2 }).count();
    const retryVisible = await page.getByRole("button", { name: "Confirm delete" }).count();
    evidence.failure = {
      alertText,
      pendingCleared: pendingAfterFailure === 0,
      jobRemains: stillVisible === 1,
      retryVisible: retryVisible === 1,
      failureHits,
    };
    if (!alertText || pendingAfterFailure !== 0 || stillVisible !== 1 || retryVisible !== 1) {
      throw new Error(`Failure recovery did not clear pending state: ${JSON.stringify(evidence.failure)}`);
    }

    await page.unroute(`**/api/jobs/${failureJob}`);
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await page.getByRole("button", { name: "Deleting…" }).waitFor({ state: "hidden", timeout: 20000 });
    await page.getByRole("link", { name: /M30A Headed Failure/ }).waitFor({ state: "hidden", timeout: 20000 });
    evidence.failureRetry = "success";

    let repeatHits = 0;
    await page.route(`**/api/jobs/${repeatJob}`, async (route) => {
      if (route.request().method() === "DELETE") {
        repeatHits += 1;
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.continue();
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(repeatJob)}`, {
      waitUntil: "domcontentloaded",
    });
    await openDeleteConfirm(page);
    const confirm = page.getByRole("button", { name: "Confirm delete" });
    await confirm.click();
    await confirm.click({ force: true }).catch(() => undefined);
    await page.getByRole("button", { name: "Deleting…" }).waitFor({ state: "hidden", timeout: 20000 });
    evidence.repeatedClicks = repeatHits;
    if (repeatHits !== 1) throw new Error(`Expected one delete request, saw ${repeatHits}`);

    console.log(JSON.stringify({ ok: true, ...evidence }, null, 2));
  } finally {
    const user = await prisma.user.findUnique({
      where: { email: "m21-test@careeros.local" },
      select: { id: true },
    });
    if (user) {
      await prisma.jobPosting.deleteMany({
        where: { userId: user.id, title: { startsWith: "M30A " } },
      });
    }
    await prisma.$disconnect();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
