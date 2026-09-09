import "dotenv/config";

import { startFixtureServer, FIXTURE_ORIGIN } from "@/features/application-execution/fixtures/server";
import { getApplicationBrowserRunner } from "@/features/application-execution/browser/browser-runtime-registry";
import { detectProvider, selectAdapter } from "@/features/application-execution/adapters/adapter-registry";
import { closeAllBrowserRuntimes } from "@/features/application-execution/server";

const PROVIDERS = ["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE", "SMARTRECRUITERS"] as const;

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function run() {
  const fixtures = await startFixtureServer();
  const runner = getApplicationBrowserRunner();
  const evidence: Record<string, unknown> = {};
  try {
    for (const provider of PROVIDERS) {
      const sessionId = `fixture-${provider.toLowerCase()}`;
      await runner.launch(sessionId);
      await runner.navigate(sessionId, `${FIXTURE_ORIGIN}/${provider.toLowerCase()}`);
      const page = runner.getPage(sessionId);
      if (!page) throw new Error(`Missing page for ${provider}`);
      const detection = await detectProvider(page);
      const adapter = selectAdapter(detection.provider, false);
      const snapshot = await adapter.inspect(page);
      evidence[provider] = {
        detected: detection.provider,
        confidence: detection.confidence,
        fieldCount: snapshot.fields.length,
        submit: snapshot.submitControl?.label ?? null,
      };
      assert(detection.provider === provider, `${provider} fixture must detect ${provider}, got ${detection.provider}`);
      assert(detection.confidence >= 0.9, `${provider} fixture confidence too low`);
      assert(snapshot.fields.length >= 8, `${provider} fixture inspect too thin`);
      await runner.close(sessionId);
    }

    const driftId = "fixture-greenhouse-drift";
    await runner.launch(driftId);
    await runner.navigate(driftId, `${FIXTURE_ORIGIN}/greenhouse?variant=drift`);
    const driftPage = runner.getPage(driftId);
    if (!driftPage) throw new Error("Missing drift page");
    const driftDetection = await detectProvider(driftPage);
    evidence.driftDetection = { provider: driftDetection.provider, confidence: driftDetection.confidence, reasons: driftDetection.reasons };
    let driftOutcome = "none";
    try {
      await selectAdapter("GREENHOUSE", false).inspect(driftPage);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";
      if (code === "ADAPTER_DRIFT" || (error instanceof Error && error.message === "ADAPTER_DRIFT")) {
        const generic = selectAdapter("GENERIC", true);
        const snapshot = await generic.inspect(driftPage);
        driftOutcome = snapshot.fields.length > 0 ? "FALLBACK_VERIFIED" : "FAILED";
      } else {
        throw error;
      }
    }
    evidence.driftOutcome = driftOutcome;
    assert(driftOutcome === "FALLBACK_VERIFIED", "Greenhouse drift fixture must fall back to Generic inspect");
    await runner.close(driftId);

    evidence.ok = true;
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await closeAllBrowserRuntimes();
    await fixtures.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
