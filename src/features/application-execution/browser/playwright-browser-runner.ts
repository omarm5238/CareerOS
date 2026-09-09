import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import type { ApplicationBrowserPage, ApplicationBrowserRunner, UploadedFileSpec } from "./application-browser-runner";

type RuntimeEntry = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

const runtimes = new Map<string, RuntimeEntry>();

function headedDefault(): boolean {
  return process.env.CAREEROS_BROWSER_HEADLESS !== "1";
}

class PlaywrightPageHandle implements ApplicationBrowserPage {
  constructor(private readonly page: Page) {}

  url(): string {
    return this.page.url();
  }

  title(): Promise<string> {
    return this.page.title();
  }

  async evaluate<T>(fn: (arg: unknown) => T | Promise<T>, arg?: unknown): Promise<T> {
    return this.page.evaluate(fn, arg);
  }

  async evaluateExpression<T>(expression: string): Promise<T> {
    return this.page.evaluate(expression);
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).first().fill(value);
  }

  async check(selector: string, checked: boolean): Promise<void> {
    const locator = this.page.locator(selector).first();
    if (checked) await locator.check({ force: true });
    else await locator.uncheck({ force: true });
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).first().selectOption(value);
  }

  async setInputFiles(selector: string, file: UploadedFileSpec): Promise<void> {
    await this.page.locator(selector).first().setInputFiles(file.filePath);
  }

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).first().click({ timeout: 15_000, noWaitAfter: true });
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async contentSignals() {
    return this.page.evaluate(() => {
      const text = document.body?.innerText?.slice(0, 4000) ?? "";
      const markers = Array.from(document.querySelectorAll("[data-careeros-marker], [data-ats], [data-provider-success], [data-provider-error]")).map(
        (node) => `${node.getAttribute("data-careeros-marker") ?? ""} ${node.getAttribute("data-ats") ?? ""} ${node.getAttribute("data-provider-success") ?? ""} ${node.getAttribute("data-provider-error") ?? ""}`,
      );
      return {
        title: document.title,
        url: location.href,
        markers,
        hasPasswordField: Boolean(document.querySelector('input[type="password"]')),
        hasOtpField: Boolean(document.querySelector('[data-careeros-mfa], input[name*="otp" i], input[autocomplete="one-time-code"]')),
        hasCaptcha: Boolean(document.querySelector("[data-careeros-captcha], .g-recaptcha, iframe[src*='recaptcha'], iframe[src*='hcaptcha']")),
        hasAssessment: Boolean(document.querySelector("[data-careeros-assessment]")),
        hasChallengeFrame: Array.from(document.querySelectorAll("iframe")).some((frame) =>
          /captcha|challenge|turnstile|hcaptcha|recaptcha/i.test(frame.src || frame.id || frame.name),
        ),
        bodyTextSample: text,
      };
    });
  }
}

export class PlaywrightApplicationBrowserRunner implements ApplicationBrowserRunner {
  async launch(sessionId: string): Promise<void> {
    const existing = runtimes.get(sessionId);
    if (existing) {
      try {
        await existing.page.title();
        return;
      } catch {
        await this.close(sessionId);
      }
    }

    const browser = await chromium.launch({
      headless: !headedDefault(),
      args: ["--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      acceptDownloads: false,
    });
    const page = await context.newPage();
    runtimes.set(sessionId, { browser, context, page });
  }

  isAlive(sessionId: string): boolean {
    return runtimes.has(sessionId);
  }

  getPage(sessionId: string): ApplicationBrowserPage | null {
    const entry = runtimes.get(sessionId);
    return entry ? new PlaywrightPageHandle(entry.page) : null;
  }

  async navigate(sessionId: string, url: string): Promise<{ url: string; title: string }> {
    const entry = runtimes.get(sessionId);
    if (!entry) throw new Error("BROWSER_CRASHED");
    await entry.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    return { url: entry.page.url(), title: await entry.page.title() };
  }

  async close(sessionId: string): Promise<void> {
    const entry = runtimes.get(sessionId);
    if (!entry) return;
    runtimes.delete(sessionId);
    await entry.context.close().catch(() => undefined);
    await entry.browser.close().catch(() => undefined);
  }

  async closeAll(): Promise<void> {
    const ids = [...runtimes.keys()];
    await Promise.all(ids.map((id) => this.close(id)));
  }
}

export const playwrightApplicationBrowserRunner = new PlaywrightApplicationBrowserRunner();
