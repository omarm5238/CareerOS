import type { ApplicationProvider } from "@/generated/prisma/client";

import { hostnameProvider } from "../adapters/application-execution-adapter";
import type { ApplicationBrowserPage } from "../browser/application-browser-runner";

export async function isSafeOpenApplicationHref(
  page: ApplicationBrowserPage,
  selector: string,
  provider: ApplicationProvider,
): Promise<boolean> {
  const href = await page.evaluate((sel) => {
    const el = document.querySelector(String(sel));
    if (!el) return null;
    const link = el.closest("a") ?? (el.tagName === "A" ? el : null);
    return link ? (link as HTMLAnchorElement).href : null;
  }, selector);
  if (!href) return true;
  try {
    const target = new URL(href);
    const current = new URL(page.url());
    if (target.origin === current.origin) return true;
    const host = hostnameProvider(href);
    return host?.provider === provider;
  } catch {
    return false;
  }
}
