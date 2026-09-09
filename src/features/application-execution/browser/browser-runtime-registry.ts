import type { ApplicationBrowserRunner } from "./application-browser-runner";
import { playwrightApplicationBrowserRunner } from "./playwright-browser-runner";

let runner: ApplicationBrowserRunner = playwrightApplicationBrowserRunner;

export function getApplicationBrowserRunner(): ApplicationBrowserRunner {
  return runner;
}

export function setApplicationBrowserRunner(next: ApplicationBrowserRunner): void {
  runner = next;
}

export async function closeAllBrowserRuntimes(): Promise<void> {
  await runner.closeAll();
}
