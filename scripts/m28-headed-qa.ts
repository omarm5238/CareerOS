import "dotenv/config";

import { chromium } from "playwright";
import { prisma } from "@/server/db/prisma";
import { createUserDeclaredMemory, getOrCreateCareerMemoryPreference, refreshCareerMemory } from "@/features/career-memory/server";

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
      text: document.body.innerText.slice(0, 1200),
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
  await getOrCreateCareerMemoryPreference(user.id);
  await refreshCareerMemory(user.id, { mode: "ON_DEMAND" });
  await createUserDeclaredMemory(user.id, { category: "skill", value: "PostgreSQL" }).catch(() => undefined);

  const browser = await chromium.launch({ headless: false, args: ["--disable-dev-shm-usage"] });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const desktopPage = await desktop.newPage();
    const mobilePage = await mobile.newPage();
    const signIn = await login(desktopPage);
    await login(mobilePage);

    await desktopPage.goto(`${BASE}/workspace/memory`, { waitUntil: "domcontentloaded", timeout: 60000 });
    if ((await desktopPage.getByTestId("refresh-memory").count()) > 0) {
      await desktopPage.getByTestId("refresh-memory").click();
      await desktopPage.waitForTimeout(1200);
    }
    const desktopMemory = await measure(desktopPage);
    if ((await desktopPage.getByTestId("create-memory").count()) > 0) {
      await desktopPage.getByTestId("manual-memory-value").fill("Distributed systems");
      await desktopPage.getByTestId("create-memory").click();
      await desktopPage.waitForTimeout(800);
    }
    if ((await desktopPage.getByTestId("memory-card").count()) > 0) {
      const confirm = desktopPage.getByRole("button", { name: "Confirm" }).first();
      if ((await confirm.count()) > 0) await confirm.click();
      await desktopPage.waitForTimeout(600);
    }

    await mobilePage.goto(`${BASE}/workspace/memory`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await mobilePage.waitForTimeout(600);
    const mobileMemory = await measure(mobilePage);
    const overflow = Boolean(desktopMemory.overflow || mobileMemory.overflow);
    const ok = signIn === 200 && desktopMemory.href.includes("/workspace/memory") && !overflow;
    console.log(JSON.stringify({ signIn, desktopMemory, mobileMemory, overflow, ok }, null, 2));
    if (!ok) throw new Error("M28 headed memory QA failed.");
  } finally {
    await browser.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
