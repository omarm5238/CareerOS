import "dotenv/config";

import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { upsertDiscoveryProfile } from "@/features/jobs/discovery/lib/update-discovery-profile";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";

const BASE = "http://localhost:3000";
const OUT = join(process.cwd(), "qa-artifacts", "m31-closure");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseColor(value: string): [number, number, number, number] | null {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] == null ? 1 : Number(match[4])];
}

function contrast(foreground: string, background: string): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg || bg[3] === 0) return 0;
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const lum = (color: [number, number, number, number]) =>
    0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
  const lighter = Math.max(lum(fg), lum(bg));
  const darker = Math.min(lum(fg), lum(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const stamp = Date.now();
  const email = `m31-closure-${stamp}@careeros.local`;
  const password = "Milestone31Closure!";
  const consoleMessages: string[] = [];
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const location = message.location();
      consoleMessages.push(`${message.type()}: ${message.text()} @ ${location.url}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const signup = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
      data: { email, password, name: "M31 Closure" },
    });
    assert(signup.ok(), `Sign-up failed: ${signup.status()}`);
    const session = await page.request.get(`${BASE}/api/auth/get-session`);
    const sessionJson = await session.json() as { user?: { id?: string } };
    const userId = sessionJson.user?.id;
    assert(userId, "Signed-up user id was missing");
    await upsertDiscoveryProfile(userId, {
      roleTargets: [{ title: "Full-stack Developer", aliases: [], priority: "high", confidence: "strong", evidence: [], enabled: true }],
      workModes: ["REMOTE"],
      searchIntent: {
        locationMode: "CURRENT_COUNTRY_PLUS_REMOTE",
        currentCountryCode: null,
        selectedCountryCodes: [],
        remote: { worldwide: true, regions: [], acceptingCurrentCountry: false, acceptingSelectedCountries: false },
      },
    });

    const failedResponses: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Edit Search Profile" }).waitFor({ timeout: 20000 });
    await page.getByTestId("current-country").click();
    await page.getByTestId("current-country-listbox").waitFor();
    const colors = await page.getByTestId("current-country-listbox").evaluate((list) => {
      const option = list.querySelector("[data-testid='country-option-TR']") as HTMLElement | null;
      const style = option ? getComputedStyle(option) : null;
      return {
        labels: [...list.querySelectorAll("[role='option']")].map((item) => item.textContent?.trim() ?? ""),
        optionColor: style?.color ?? "",
        optionBackground: style?.backgroundColor ?? "",
      };
    });
    const required = ["Not set", "Türkiye", "Germany", "Netherlands", "United Arab Emirates", "Saudi Arabia", "United States", "United Kingdom", "France"];
    for (const label of required) assert(colors.labels.includes(label), `Missing country option ${label}`);
    const ratio = contrast(colors.optionColor, colors.optionBackground);
    assert(ratio >= 4.5, `country option contrast ${ratio.toFixed(2)} (${colors.optionColor} on ${colors.optionBackground})`);
    await page.screenshot({ path: join(OUT, "country-dropdown-open.png") });
    await page.keyboard.press("Escape");
    await page.getByTestId("current-country-listbox").waitFor({ state: "hidden" });

    async function chooseCountry(code: string) {
      const option = page.getByTestId(`country-option-${code || "unset"}`);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await page.getByTestId("current-country").click();
        try {
          await option.click({ timeout: 2000 });
          return;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
    }

    async function saveCountry(label: string, code: string) {
      await chooseCountry(code);
      await page.getByTestId("current-country").filter({ hasText: label }).waitFor();
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes("/api/jobs/discovery/profile") && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "Save Profile" }).click();
      const response = await responsePromise;
      const body = await response.json().catch(() => null) as { profile?: { searchIntent?: { currentCountryCode?: string | null } } } | null;
      assert(response.ok(), `Save profile failed: ${response.status()}`);
      assert((body?.profile?.searchIntent?.currentCountryCode ?? null) === (code || null), `Saved country was ${body?.profile?.searchIntent?.currentCountryCode ?? "missing"}`);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByTestId("current-country").filter({ hasText: label }).waitFor();
    }

    await saveCountry("Türkiye", "TR");
    await saveCountry("Germany", "DE");
    await saveCountry("Not set", "");

    const realUser = await prisma.user.findFirst({
      where: { resumeSourceRevisions: { some: { sourceFilename: "cv.pdf", isActive: true } } },
      select: { id: true },
    });
    assert(realUser, "real cv.pdf user is missing");
    const token = randomBytes(24).toString("hex");
    const created = await prisma.session.create({
      data: { userId: realUser.id, token, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const authContext = await auth.$context;
    const signed = `${token}.${createHmac("sha256", authContext.secret).update(token).digest("base64")}`;
    const realContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await realContext.addCookies([{
      name: authContext.authCookies.sessionToken.name,
      value: signed,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    }]);
    const realPage = await realContext.newPage();
    const realFailed: string[] = [];
    realPage.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") consoleMessages.push(`real ${message.type()}: ${message.text()}`);
    });
    realPage.on("pageerror", (error) => consoleMessages.push(`real pageerror: ${error.message}`));
    realPage.on("response", (response) => {
      if (response.status() >= 400) realFailed.push(`${response.status()} ${response.url()}`);
    });
    async function nextIssueText() {
      await realPage.waitForTimeout(1200);
      return realPage.evaluate(() => {
        return [...document.querySelectorAll("nextjs-portal")].map((portal) =>
          (portal.shadowRoot?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1800),
        );
      });
    }
    await realPage.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded" });
    const homeText = await realPage.locator("body").innerText();
    const signedIn = !/sign in/i.test(homeText) && /cv\.pdf/i.test(homeText);
    const issueTexts: string[] = [];
    if (signedIn) {
      issueTexts.push(...await nextIssueText());
      await realPage.getByRole("button", { name: "Expand profile panel" }).click();
      await realPage.getByText(/Skills detected:/).waitFor();
      const expandedHome = await realPage.locator("body").innerText();
      assert(/Entry\s*\/\s*Junior/i.test(expandedHome), "home does not show Entry / Junior");
      await realPage.screenshot({ path: join(OUT, "home-current-resume.png"), fullPage: false });
      await realPage.goto(`${BASE}/workspace/resume`, { waitUntil: "domcontentloaded" });
      await realPage.getByText(/Detected skills/i).first().waitFor({ timeout: 20000 });
      const resumeCount = await realPage.locator("body").innerText();
      await realPage.goto(`${BASE}/workspace/skills`, { waitUntil: "domcontentloaded" });
      await realPage.getByText(/Detected skills/i).first().waitFor({ timeout: 20000 });
      const skillsCount = await realPage.locator("body").innerText();
      const resumeDetected = resumeCount.match(/Detected skills\s*(\d+)/i)?.[1] ?? null;
      const skillsDetected = skillsCount.match(/Detected skills\s*(\d+)/i)?.[1] ?? null;
      const homeDetected = expandedHome.match(/Skills detected:\s*(\d+)/i)?.[1] ?? null;
      assert(homeDetected && homeDetected === resumeDetected && resumeDetected === skillsDetected, `skill counts home=${homeDetected} resume=${resumeDetected} skills=${skillsDetected}`);
      assert(!/Languages:\s*TypeScript/i.test(skillsCount), "prefixed TypeScript duplicate is visible");
      assert(!/Databases\s*\/\s*Data:\s*PostgreSQL/i.test(skillsCount), "prefixed PostgreSQL duplicate is visible");
      issueTexts.push(...await nextIssueText());
      await realPage.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
      await realPage.getByText("Senior .NET Full-stack Developer").first().waitFor({ timeout: 20000 });
      const card = realPage.locator("article").filter({ hasText: "Senior .NET Full-stack Developer" }).first();
      const cardText = await card.innerText();
      assert(!/\b79\b/.test(cardText), "discovery card still shows 79");
      assert(!/STRONG/i.test(cardText), "discovery card still shows STRONG");
      assert(/Ineligible/i.test(cardText), "discovery card does not show ineligible");
      assert(/SENIORITY_MISMATCH/.test(cardText), "seniority blocker is not visible");
      assert(/CORE_STACK_MISMATCH/.test(cardText), "stack blocker is not visible");
      await card.screenshot({ path: join(OUT, "senior-dotnet-current-result.png") });

      const saved = await prisma.jobPosting.findFirst({
        where: { userId: realUser.id, title: "Senior .NET Full-stack Developer", company: "Lemon.io" },
        select: { id: true },
      });
      assert(saved, "saved Senior .NET job is missing");
      await realPage.goto(`${BASE}/workspace/jobs?jobId=${saved.id}`, { waitUntil: "domcontentloaded" });
      const ineligible = realPage.getByText("Ineligible").first();
      await ineligible.waitFor({ timeout: 20000 });
      await ineligible.scrollIntoViewIfNeeded();
      await realPage.screenshot({ path: join(OUT, "saved-senior-dotnet.png"), fullPage: false });
      await realPage.getByTestId("analyze-opportunity").click();
      const provenanceNode = realPage.getByTestId("opportunity-provenance").filter({ hasText: "cv.pdf" });
      await provenanceNode.waitFor({ timeout: 30000 });
      const provenance = await provenanceNode.innerText();
      assert(/revision 1/i.test(provenance), provenance);
      await provenanceNode.scrollIntoViewIfNeeded();
      await provenanceNode.screenshot({ path: join(OUT, "fresh-opportunity-provenance.png") });
      issueTexts.push(...await nextIssueText());
    }
    await prisma.session.delete({ where: { id: created.id } }).catch(() => undefined);
    await realContext.close();

    await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded" });
    const issueCount = await page.getByText(/\d+\s+Issue/).count();
    console.log(JSON.stringify({
      optionContrast: Number(ratio.toFixed(2)),
      optionColor: colors.optionColor,
      optionBackground: colors.optionBackground,
      countryPersisted: true,
      realSessionAccepted: signedIn,
      nextIssueCount: issueCount,
      nextIssueText: issueTexts.filter(Boolean).slice(0, 6),
      failedResponses: [...failedResponses, ...realFailed].slice(0, 20),
      console: consoleMessages.slice(0, 40),
    }));
    if (!signedIn) throw new Error("Real-user session cookie was not accepted");
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
