import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3000";

async function login(page: Page) {
  const auth = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: "m21-test@careeros.local", password: "Milestone21Test!" },
  });
  if (auth.status() !== 200) throw new Error(`Sign-in failed: ${auth.status()}`);
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await login(page);
    const profileResponse = await page.request.get(`${BASE}/api/jobs/discovery/profile`);
    const profileBody = await profileResponse.json() as { profile?: { roleTargets?: unknown; providerPreferences?: unknown } };
    if (!profileBody.profile) throw new Error("Test user has no search profile");

    const saved = await page.request.patch(`${BASE}/api/jobs/discovery/profile`, {
      data: {
        providerPreferences: profileBody.profile.providerPreferences ?? {},
        searchIntent: {
          preferredTitles: ["Backend Engineer", "Full-Stack Engineer"],
          excludedTitles: ["Sales Engineer", "Support Engineer", "Recruiter", "Journalist"],
          allowedSeniority: ["INTERN", "ENTRY", "JUNIOR", "MID"],
          excludedSeniority: ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"],
          preferredStack: ["TypeScript", "PostgreSQL", "Node.js"],
          avoidWhenMandatoryStack: ["C#", ".NET", "PHP", "Laravel"],
          locationMode: "CURRENT_COUNTRY",
          currentCountryCode: "TR",
          currentCity: "Istanbul",
          selectedCountryCodes: [],
          remote: { worldwide: false, regions: [], acceptingCurrentCountry: true, acceptingSelectedCountries: false },
          employmentTypes: ["FULL_TIME", "INTERNSHIP"],
          freshnessDays: 14,
          minimumTrust: "TIER_C",
          aggregatorsAllowed: true,
        },
      },
    });
    if (!saved.ok()) throw new Error(`Profile save failed: ${saved.status()}`);

    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Edit Search Profile" }).waitFor({ timeout: 20000 });
    const country = page.locator("select").first();
    if ((await country.inputValue()) !== "TR") throw new Error("Current country did not load as Türkiye");

    await page.getByRole("radio", { name: "Selected countries", exact: true }).check();
    await page.getByRole("checkbox", { name: "Germany" }).check();
    await page.getByRole("checkbox", { name: "Netherlands" }).check();
    await page.getByRole("checkbox", { name: "Worldwide" }).check();
    await page.getByRole("button", { name: "Save Profile" }).click();
    await page.getByText("Saving…").waitFor({ state: "hidden", timeout: 20000 }).catch(() => undefined);

    const selectedRun = await page.request.post(`${BASE}/api/jobs/discovery/run`, { data: { force: true } });
    const selectedBody = await selectedRun.json() as { status?: string; filterStats?: { geoFiltered?: number; kept?: number }; message?: string };
    if (!selectedRun.ok()) throw new Error(`Selected-country discovery failed: ${selectedBody.message ?? selectedRun.status()}`);

    await page.request.patch(`${BASE}/api/jobs/discovery/profile`, {
      data: {
        providerPreferences: profileBody.profile.providerPreferences ?? {},
        searchIntent: {
          preferredTitles: ["Backend Engineer", "Full-Stack Engineer"],
          excludedTitles: ["Sales Engineer", "Support Engineer"],
          allowedSeniority: ["INTERN", "ENTRY", "JUNIOR", "MID"],
          excludedSeniority: ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"],
          preferredStack: ["TypeScript", "PostgreSQL"],
          avoidWhenMandatoryStack: ["C#", ".NET"],
          locationMode: "CURRENT_COUNTRY_PLUS_REMOTE",
          currentCountryCode: "TR",
          selectedCountryCodes: ["DE", "NL"],
          remote: { worldwide: true, regions: ["EMEA"], acceptingCurrentCountry: true, acceptingSelectedCountries: true },
          employmentTypes: ["FULL_TIME"],
          freshnessDays: 14,
          minimumTrust: "TIER_B",
          aggregatorsAllowed: true,
        },
      },
    });
    const remoteRun = await page.request.post(`${BASE}/api/jobs/discovery/run`, { data: { force: true } });
    const remoteBody = await remoteRun.json() as { status?: string; filterStats?: Record<string, number | boolean>; message?: string };
    if (!remoteRun.ok()) throw new Error(`Remote discovery failed: ${remoteBody.message ?? remoteRun.status()}`);

    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Fetched/).waitFor({ timeout: 20000 });
    const text = await page.locator("body").innerText();
    if (/Senior \.NET/i.test(text)) throw new Error("Senior .NET survived into discovery results");
    if (/Tech Journalist/i.test(text)) throw new Error("Journalist survived into discovery results");
    const cards = await page.locator("article").count();
    if (cards > 0 && !/Source:/.test(text)) throw new Error("Result cards do not show a source");
    if (cards > 0 && !/Posted|Date unknown/.test(text)) throw new Error("Result cards do not show freshness");

    console.log(JSON.stringify({
      ok: true,
      selectedRun: selectedBody.status,
      remoteRun: remoteBody.status,
      filterStats: remoteBody.filterStats,
      cards,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
