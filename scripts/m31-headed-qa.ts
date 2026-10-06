import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

import { chromium } from "playwright";

import { prisma } from "@/server/db/prisma";

const BASE = "http://localhost:3000";

function u16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function zip(files: Array<{ name: string; data: Buffer }>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const compressed = deflateRawSync(file.data);
    const checksum = crc32(file.data);
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(file.data.length),
      u16(name.length), u16(0),
      name,
      compressed,
    ]);
    locals.push(local);
    centrals.push(Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
      u32(checksum), u32(compressed.length), u32(file.data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
      name,
    ]));
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  return Buffer.concat([
    ...locals,
    central,
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0),
  ]);
}

function docx(paragraphs: string[]) {
  const body = paragraphs.map((text) => `<w:p><w:r><w:t xml:space="preserve">${text.replaceAll("&", "&amp;")}</w:t></w:r></w:p>`).join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`),
    },
    { name: "word/document.xml", data: Buffer.from(document) },
  ]);
}

const resumeA = [
  "Skills",
  "TypeScript, Node.js, PostgreSQL, React",
  "Projects",
  "CareerOS TypeScript API",
  "https://github.com/example/careeros",
  "Experience",
  "Backend Engineer, Full-time",
  "Jan 2022 - Jan 2024",
  "Built TypeScript services for a product team.",
];

const resumeB = [
  "Skills",
  "Go, PostgreSQL",
  "Experience",
  "Backend Engineer, Full-time",
  "Mar 2023 - Mar 2025",
  "Built Go services for a product team.",
  "This later resume has no TypeScript and no GitHub link.",
];

async function uploadResume(page: import("playwright").Page, file: string) {
  await page.goto(`${BASE}/workspace/resume`, { waitUntil: "domcontentloaded" });
  const upload = page.getByTestId("resume-upload-ready");
  await upload.waitFor({ timeout: 20000 });
  await upload.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Analyze resume" }).waitFor();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Choose file").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
  try {
    await page.getByText("Selected:").waitFor({ timeout: 10000 });
  } catch (error) {
    const body = await page.locator("body").innerText();
    throw new Error(`Resume file was not accepted.\n${body.slice(0, 800)}\n${error instanceof Error ? error.message : ""}`);
  }
  await page.getByRole("button", { name: "Analyze resume" }).click();
}

async function run() {
  const stamp = Date.now();
  const email = `m31-headed-${stamp}@careeros.local`;
  const password = "Milestone31Test!";
  const dir = join(tmpdir(), `careeros-m31-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const fileA = join(dir, "m31-a.docx");
  const fileB = join(dir, "m31-b.docx");
  writeFileSync(fileA, docx(resumeA));
  writeFileSync(fileB, docx(resumeB));

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const signup = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
      data: { email, password, name: "M31 Headed" },
    });
    if (!signup.ok()) throw new Error(`Sign-up failed: ${signup.status()} ${await signup.text()}`);

    await uploadResume(page, fileA);
    await page.getByTestId("resume-truth-status").filter({ hasText: "Current analysis" }).waitFor({ timeout: 30000 });
    await page.getByTestId("resume-revision-number").filter({ hasText: "Revision 1" }).waitFor();
    await page.getByTestId("resume-provenance").filter({ hasText: "m31-a.docx" }).waitFor();
    const currentText = await page.getByTestId("resume-provenance").innerText();
    if (/skills section/i.test(currentText)) throw new Error("Current provenance advertised a skills-section gap");

    await page.goto(`${BASE}/workspace/skills`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("current-skills").filter({ hasText: "TypeScript" }).waitFor({ timeout: 20000 });
    const skillsA = await page.getByTestId("current-skills").innerText();
    if (/\bGo\b/.test(skillsA)) throw new Error("Skills showed Go before revision B");

    await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("home-resume-truth").filter({ hasText: "m31-a.docx" }).waitFor({ timeout: 20000 });
    const homeA = await page.getByTestId("home-resume-truth").innerText();
    if (!homeA.includes("TypeScript")) throw new Error("Home did not show revision A skills");

    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("discovery-resume-context").filter({ hasText: "m31-a.docx" }).waitFor({ timeout: 20000 });
    await page.getByTestId("discovery-resume-context").filter({ hasText: "Revision 1" }).waitFor();

    const created = await page.request.post(`${BASE}/api/jobs`, {
      data: {
        title: "Backend Engineer",
        company: "CareerOS QA",
        location: "Istanbul",
        description: "Backend Engineer in Istanbul. Required: TypeScript. The description is long enough to save and analyze this local fixture without an external provider.",
      },
    });
    if (created.status() !== 201) throw new Error(`Job create failed: ${created.status()} ${await created.text()}`);
    const job = await created.json() as { id: string };
    await page.goto(`${BASE}/workspace/jobs?jobId=${job.id}`, { waitUntil: "domcontentloaded" });
    const analyzeButton = page.getByTestId("analyze-opportunity");
    await analyzeButton.waitFor({ timeout: 20000 });
    let analyzeResponse = null;
    for (let attempt = 0; attempt < 3 && !analyzeResponse; attempt += 1) {
      const pending = page.waitForResponse((response) => response.url().includes("/opportunities/") && response.url().includes("/analyze") && response.request().method() === "POST", { timeout: 8000 }).catch(() => null);
      await analyzeButton.click();
      analyzeResponse = await pending;
    }
    if (!analyzeResponse) throw new Error("Opportunity analyze request did not start");
    if (!analyzeResponse.ok()) {
      throw new Error(`Opportunity analyze failed: ${analyzeResponse.status()} ${await analyzeResponse.text()}`);
    }
    await page.getByTestId("opportunity-evidence").filter({ hasText: "TypeScript" }).waitFor({ timeout: 30000 });
    const evidence = await page.getByTestId("opportunity-evidence").innerText();
    if (!evidence.includes("MATCHED")) throw new Error(`TypeScript evidence was not matched: ${evidence}`);
    await page.getByTestId("opportunity-provenance").filter({ hasText: "m31-a.docx" }).waitFor();
    await page.getByTestId("opportunity-provenance").filter({ hasText: "revision 1" }).waitFor();

    await uploadResume(page, fileB);
    await page.getByTestId("resume-revision-number").filter({ hasText: "Revision 2" }).waitFor({ timeout: 30000 });
    await page.getByTestId("resume-truth-status").filter({ hasText: "Current analysis" }).waitFor();
    const currentRecommendations = await page.locator("#resume-improvement-center").innerText();
    if (/m31-a/i.test(currentRecommendations)) throw new Error("Revision A recommendation text leaked into the current center");

    await page.goto(`${BASE}/workspace/skills`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("current-skills").filter({ hasText: "Go" }).waitFor({ timeout: 20000 });
    const skillsB = await page.getByTestId("current-skills").innerText();
    if (/TypeScript/.test(skillsB)) throw new Error("Skills kept TypeScript from revision A");

    await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("home-resume-truth").filter({ hasText: "m31-b.docx" }).waitFor({ timeout: 20000 });
    const homeB = await page.getByTestId("home-resume-truth").innerText();
    if (/TypeScript/.test(homeB) || !homeB.includes("Go")) throw new Error("Home kept revision A as current");

    await page.goto(`${BASE}/workspace/jobs/discover`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("discovery-resume-context").filter({ hasText: "m31-b.docx" }).waitFor({ timeout: 20000 });
    await page.getByTestId("discovery-resume-context").filter({ hasText: "Revision 2" }).waitFor();
    const discoveryB = await page.getByTestId("discovery-resume-context").innerText();
    if (/m31-a\.docx/.test(discoveryB)) throw new Error("Discovery still cited revision A");

    await page.goto(`${BASE}/workspace/jobs?jobId=${job.id}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("opportunity-provenance").filter({ hasText: "changed since this analysis" }).waitFor({ timeout: 20000 });
    const prepare = page.getByTestId("prepare-application");
    if (await prepare.isDisabled()) {
      await page.getByText("Ineligible").first().waitFor({ timeout: 20000 });
    } else {
      await prepare.click();
      await page.getByText(/Re-run opportunity analysis|fresh resume analysis|out of date|changed since/i).waitFor({ timeout: 20000 });
    }

    let rerunResponse = null;
    for (let attempt = 0; attempt < 3 && !rerunResponse; attempt += 1) {
      const pending = page.waitForResponse((response) => response.url().includes("/analyze") && response.request().method() === "POST", { timeout: 8000 }).catch(() => null);
      await page.getByTestId("analyze-opportunity").click();
      rerunResponse = await pending;
    }
    if (!rerunResponse) throw new Error("Opportunity rerun request did not start");
    if (!rerunResponse.ok()) throw new Error(`Opportunity rerun failed: ${rerunResponse.status()} ${await rerunResponse.text()}`);
    await page.getByTestId("opportunity-provenance").filter({ hasText: "revision 2" }).waitFor({ timeout: 30000 });
    await page.getByTestId("opportunity-provenance").filter({ hasText: "m31-b.docx" }).waitFor();

    await page.goto(`${BASE}/workspace/resume`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /m31-a\.docx/ }).click();
    await page.getByTestId("resume-truth-status").filter({ hasText: /Outdated analysis|Historical analysis/ }).waitFor({ timeout: 20000 });
    await page.getByRole("heading", { name: "Historical recommendations" }).waitFor();
  } finally {
    await browser.close();
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
  console.log("m31:headed PASS");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
