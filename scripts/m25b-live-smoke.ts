import "dotenv/config";

import { areOfficialLinkedinCredentialsConfigured, getLinkedinProviderMode } from "@/features/linkedin/integration/config";
import { isLiveTestPublishAllowed } from "@/features/linkedin/integration/config";

async function run() {
  const configured = areOfficialLinkedinCredentialsConfigured();
  const provider = getLinkedinProviderMode();
  const allowPublish = isLiveTestPublishAllowed();

  const result = {
    LIVE_OAUTH: configured ? "CONFIGURED" : "LIVE_NOT_CONFIGURED",
    LIVE_PUBLISH: allowPublish ? "FLAG_SET_BUT_NOT_AUTHORIZED_IN_THIS_SCRIPT" : "NOT_RUN",
    provider,
    note: configured
      ? "Credentials are present. This smoke does not perform a live OAuth browser handshake or publish."
      : "No LINKEDIN_CLIENT_ID/SECRET in this environment. Fixture QA remains the Core proof.",
  };

  if (allowPublish) {
    console.log(
      JSON.stringify(
        {
          ...result,
          LIVE_PUBLISH: "NOT_RUN",
          blocked: "CAREEROS_LINKEDIN_ALLOW_LIVE_TEST_PUBLISH is set, but M25B live publish requires explicit user authorization.",
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
