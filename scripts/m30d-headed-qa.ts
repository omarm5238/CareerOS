import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3000";

async function login(page: Page) {
  const auth = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: "m21-test@careeros.local", password: "Milestone21Test!" },
  });
  if (auth.status() !== 200) throw new Error(`Sign-in failed: ${auth.status()}`);
}

function intent(overrides: Record<string, unknown>) {
  return {
    preferredTitles: ["Backend Engineer", "Full-Stack Engineer", "Software Engineer"],
    excludedTitles: ["Sales Engineer", "Support Engineer", "Recruiter", "Journalist"],
    allowedSeniority: ["INTERN", "ENTRY", "JUNIOR", "MID"],
    excludedSeniority: ["SENIOR", "STAFF", "PRINCIPAL", "LEAD", "MANAGEMENT"],
    preferredStack: ["TypeScript", "PostgreSQL", "Node.js"],
    avoidWhenMandatoryStack: ["C#", ".NET"],
    employmentTypes: ["FULL_TIME", "INTERNSHIP"],
    freshnessDays: 45,
    minimumTrust: "TIER_C",
    aggregatorsAllowed: true,
    ...overrides,
  };
}

async function saveIntent(page: Page, preferences: unknown, searchIntent: Record<string, unknown>) {
  const saved = await page.request.patch(`${BASE}/api/jobs/discovery/profile`, {
    data: { providerPreferences: preferences ?? {}, searchIntent },
  });
  if (!saved.ok()) throw new Error(`Profile save failed: ${saved.status()}`);
}

async function discover(page: Page) {
  const response = await page.request.post(`${BASE}/api/jobs/discovery/run`, {
    data: { force: true },
    timeout: 180_000,
  });
  const body = await response.json() as {
    status?: string;
    message?: string;
    filterStats?: Record<string, number>;
    providerStats?: { provider: string; status: string; rawResults?: number }[];
  };
  if (!response.ok()) throw new Error(body.message ?? `Discovery failed: ${response.status()}`);
  return body;
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await login(page);
    const profileResponse = await page.request.get(`${BASE}/api/jobs/discovery/profile`);
    const profileBody = await profileResponse.json() as { profile?: { providerPreferences?: unknown } };
    if (!profileBody.profile) throw new Error("Test user has no search profile");
    const preferences = profileBody.profile.providerPreferences ?? {};

    await saveIntent(page, preferences, intent({
      locationMode: "CURRENT_COUNTRY",
      currentCountryCode: "TR",
      currentCity: "Istanbul",
      selectedCountryCodes: ["TR"],
      remote: { worldwide: false, regions: [], acceptingCurrentCountry: false, acceptingSelectedCountries: false },
    }));
    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByText("Lever — Available").waitFor({ timeout: 20000 });
    await page.getByText("LinkedIn — Partner access required").waitFor({ timeout: 20000 });
    const turkey = await discover(page);
    const turkeyLever = turkey.providerStats?.find((item) => item.provider === "LEVER");
    if (!turkeyLever || (turkeyLever.status !== "success" && turkeyLever.status !== "partial") || !(turkeyLever.rawResults && turkeyLever.rawResults > 0)) {
      throw new Error(`Türkiye Lever diagnostics missing: ${JSON.stringify(turkey.providerStats)}`);
    }

    await saveIntent(page, preferences, intent({
      locationMode: "SELECTED_COUNTRIES",
      currentCountryCode: "TR",
      selectedCountryCodes: ["DE", "NL"],
      remote: { worldwide: false, regions: [], acceptingCurrentCountry: false, acceptingSelectedCountries: false },
    }));
    const europe = await discover(page);
    const europeProviders = europe.providerStats?.filter((item) => item.provider === "GREENHOUSE" || item.provider === "EURES") ?? [];
    if (!europeProviders.some((item) => (item.status === "success" || item.status === "partial") && (item.rawResults ?? 0) > 0)) {
      throw new Error(`Europe provider diagnostics missing: ${JSON.stringify(europe.providerStats)}`);
    }

    await saveIntent(page, preferences, intent({
      locationMode: "CURRENT_COUNTRY_PLUS_REMOTE",
      currentCountryCode: "TR",
      selectedCountryCodes: ["TR"],
      remote: { worldwide: true, regions: ["EMEA"], acceptingCurrentCountry: true, acceptingSelectedCountries: false },
    }));
    const remote = await discover(page);
    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Fetched/).waitFor({ timeout: 20000 });
    const text = await page.locator("body").innerText();
    if (/Senior \.NET/i.test(text) || /Account Executive/i.test(text)) throw new Error("Excluded role survived on the board");
    const sources = await page.locator("article").allInnerTexts();
    const titles = sources.map((card) => card.split("\n")[0]?.trim()).filter(Boolean);
    if (new Set(titles).size !== titles.length) throw new Error(`Duplicate cards: ${titles.join(" | ")}`);
    if (sources.length > 0 && sources.some((card) => !/Source:/.test(card))) throw new Error("A card is missing its source");

    console.log(JSON.stringify({
      ok: true,
      turkey: { status: turkey.status, kept: turkey.filterStats?.kept, lever: turkeyLever.rawResults },
      europe: { status: europe.status, kept: europe.filterStats?.kept, providers: europeProviders },
      remote: { status: remote.status, kept: remote.filterStats?.kept },
      cards: sources.length,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
