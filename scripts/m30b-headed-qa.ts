import "dotenv/config";

import { chromium, type Page } from "playwright";
import { prisma } from "@/server/db/prisma";

const BASE = "http://localhost:3000";

const jobs = [
  {
    key: "backend",
    title: "M30B Junior Backend",
    location: "Istanbul, Türkiye",
    description:
      "Required: TypeScript, Node.js, and PostgreSQL. Junior backend role. Onsite in Istanbul. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.",
  },
  {
    key: "dotnet",
    title: "M30B Senior .NET",
    location: "Remote",
    description:
      "C# and ASP.NET are mandatory. 5+ years of commercial .NET experience. Senior role. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.",
  },
  {
    key: "journalism",
    title: "M30B Tech Journalist",
    location: "Istanbul, Türkiye",
    description:
      "Write technology news and interview founders. No software delivery. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.",
  },
  {
    key: "us",
    title: "M30B US Remote Backend",
    location: "Remote",
    description:
      "Required: TypeScript and PostgreSQL. Junior backend. US-only remote. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.",
  },
  {
    key: "borderline",
    title: "M30B Backend Optional Docker",
    location: "Istanbul, Türkiye",
    description:
      "Required: TypeScript, Node.js, and PostgreSQL. Junior backend in Istanbul. Docker is nice to have. This posting includes enough detail for a deterministic eligibility decision and is not a thin listing.",
  },
];

type CreatedJob = {
  id: string;
  analysis?: { aiWarnings?: string[]; matchScore?: number; canonicalBand?: string | null };
};

function marker(job: CreatedJob) {
  const raw = job.analysis?.aiWarnings?.find((warning) => warning.startsWith("CANONICAL|")) ?? "";
  const [, eligibility = "", band = "", score = "", reasons = ""] = raw.split("|");
  return { eligibility, band, score, reasons: reasons.split(",").filter(Boolean), raw };
}

async function login(page: Page) {
  const auth = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: "m21-test@careeros.local", password: "Milestone21Test!" },
  });
  if (auth.status() !== 200) throw new Error(`Sign-in failed: ${auth.status()}`);
}

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const evidence: Record<string, unknown> = {};
  try {
    await login(page);
    const created = new Map<string, CreatedJob>();
    for (const job of jobs) {
      const response = await page.request.post(`${BASE}/api/jobs`, {
        data: {
          title: job.title,
          company: "M30B Labs",
          location: job.location,
          description: job.description,
          source: "M30B",
        },
      });
      const body = (await response.json()) as CreatedJob & { message?: string };
      if (!response.ok() || !body.id) {
        throw new Error(`Create ${job.title} failed: ${response.status()} ${body.message ?? ""}`);
      }
      created.set(job.key, body);
    }

    const backend = marker(created.get("backend")!);
    const dotnet = marker(created.get("dotnet")!);
    const journalism = marker(created.get("journalism")!);
    const us = marker(created.get("us")!);
    const borderline = marker(created.get("borderline")!);

    if (backend.eligibility !== "ELIGIBLE" || (backend.band !== "STRONG" && backend.band !== "POSSIBLE")) {
      throw new Error(`Backend marker unexpected: ${backend.raw}`);
    }
    if (dotnet.eligibility !== "INELIGIBLE" || dotnet.band !== "INELIGIBLE" || dotnet.score !== "") {
      throw new Error(`Senior .NET must be ineligible with no actionable score: ${dotnet.raw}`);
    }
    for (const reason of ["SENIORITY_MISMATCH", "CORE_STACK_MISMATCH", "EXPERIENCE_MISMATCH"]) {
      if (!dotnet.reasons.includes(reason)) throw new Error(`Senior .NET missing ${reason}`);
    }
    if (journalism.eligibility !== "INELIGIBLE" || !journalism.reasons.includes("ROLE_FAMILY_MISMATCH")) {
      throw new Error(`Journalism marker unexpected: ${journalism.raw}`);
    }
    if (us.band === "STRONG" || us.eligibility === "ELIGIBLE") {
      throw new Error(`US-only remote must not be an eligible strong match: ${us.raw}`);
    }
    if (borderline.eligibility === "INELIGIBLE" || borderline.reasons.includes("CORE_STACK_MISMATCH")) {
      throw new Error(`Optional Docker must not block: ${borderline.raw}`);
    }

    for (const job of jobs) {
      const row = created.get(job.key)!;
      await page.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(row.id)}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: job.title, level: 2 }).waitFor({ timeout: 20000 });
      const text = await page.locator("body").innerText();
      const parsed = marker(row);
      if (parsed.eligibility === "INELIGIBLE" && !text.includes("Ineligible")) {
        throw new Error(`${job.key} detail did not show Ineligible`);
      }
      for (const reason of parsed.reasons) {
        if (!text.includes(reason)) throw new Error(`${job.key} detail missing ${reason}`);
      }
      if (parsed.eligibility !== "INELIGIBLE" && parsed.score && !text.includes(`${parsed.score}%`)) {
        throw new Error(`${job.key} detail score ${parsed.score} was not visible`);
      }
    }

    const dotnetId = created.get("dotnet")!.id;
    await page.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(dotnetId)}`, { waitUntil: "domcontentloaded" });
    const prepare = page.getByTestId("prepare-application");
    await prepare.waitFor();
    if (await prepare.isEnabled()) throw new Error("Prepare Application stayed enabled for the ineligible .NET job");

    const backendId = created.get("backend")!.id;
    const analyzed = await page.request.post(`${BASE}/api/jobs/opportunities/${backendId}/analyze`, { data: {} });
    const analysis = (await analyzed.json()) as { opportunityScore?: number; eligibilityStatus?: string; message?: string };
    const dotnetAnalysisResponse = await page.request.post(`${BASE}/api/jobs/opportunities/${dotnetId}/analyze`, { data: {} });
    const dotnetBody = (await dotnetAnalysisResponse.json()) as { opportunityScore?: number; eligibilityStatus?: string; message?: string };
    if (dotnetBody.eligibilityStatus !== "INELIGIBLE") {
      throw new Error(`Opportunity analysis did not mark .NET ineligible: ${JSON.stringify(dotnetBody)}`);
    }
    if (analysis.eligibilityStatus === "INELIGIBLE" || analysis.eligibilityStatus !== backend.eligibility) {
      throw new Error(`Opportunity analysis disagreed with saved match: ${JSON.stringify(analysis)} vs ${backend.raw}`);
    }
    if (backend.score && analysis.opportunityScore !== Number(backend.score)) {
      throw new Error(`Opportunity score ${analysis.opportunityScore} disagreed with canonical ${backend.score}`);
    }

    await page.goto(`${BASE}/workspace/jobs?jobId=${encodeURIComponent(dotnetId)}`, { waitUntil: "domcontentloaded" });
    await page.getByText("Opportunity Score Ineligible").waitFor({ timeout: 20000 });
    const after = await page.locator("body").innerText();
    if (after.includes("79") && after.includes("Strong")) {
      throw new Error("Ineligible .NET job still showed a Strong score");
    }

    evidence.markers = { backend, dotnet, journalism, us, borderline };
    evidence.opportunity = { backend: analysis, dotnet: dotnetBody };
    evidence.prepareDisabled = true;
    console.log(JSON.stringify({ ok: true, evidence }, null, 2));
  } finally {
    const user = await prisma.user.findUnique({
      where: { email: "m21-test@careeros.local" },
      select: { id: true },
    });
    if (user) {
      await prisma.jobPosting.deleteMany({
        where: { userId: user.id, title: { startsWith: "M30B " } },
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
