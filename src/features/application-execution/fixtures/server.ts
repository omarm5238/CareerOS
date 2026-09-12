import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export const FIXTURE_PORT = Number(process.env.CAREEROS_FIXTURE_PORT) || 3457;
export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

const submissions = new Map<string, { received: boolean; dropped: boolean }>();
const submitLog: string[] = [];

function html(title: string, body: string, extraHead = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${extraHead}</head><body>${body}</body></html>`;
}

function fields(prefix: string) {
  return `
    <label>First name <input name="${prefix}_first_name" data-qa="${prefix}-first-name" required></label>
    <label>Last name <input name="${prefix}_last_name" data-qa="${prefix}-last-name" required></label>
    <label>Email <input type="email" name="${prefix}_email" required></label>
    <label>Phone <input type="tel" name="${prefix}_phone" data-qa="${prefix}-phone"></label>
    <label>GitHub <input name="${prefix}_github"></label>
    <label>Portfolio <input name="${prefix}_portfolio"></label>
    <label>Resume <input type="file" name="${prefix}_resume" accept=".pdf"></label>
    <label>Cover letter <input type="file" name="${prefix}_cover" accept=".pdf"></label>
    <label>How did you hear about us?
      <select name="${prefix}_source" required>
        <option value="">Select</option>
        <option value="search">Search</option>
        <option value="referral">Referral</option>
      </select>
    </label>
    <fieldset><legend>Work mode</legend>
      <label><input type="radio" name="${prefix}_mode" value="remote"> Remote</label>
      <label><input type="radio" name="${prefix}_mode" value="hybrid"> Hybrid</label>
    </fieldset>
    <label>Why do you want to work here? <textarea name="${prefix}_why" required></textarea></label>
    <label>Are you legally authorized to work in Germany?
      <select name="${prefix}_authorization" required>
        <option value="">Select</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
    <label>Gender (EEO, optional)
      <select name="${prefix}_gender">
        <option value="">Select</option>
        <option value="decline">Decline to self-identify</option>
      </select>
    </label>
    <label><input type="checkbox" name="${prefix}_consent" required> I agree to the privacy policy</label>
  `;
}

function genericPage(search: URLSearchParams) {
  const variant = search.get("variant") || "default";
  if (variant === "login") {
    return html("Sign in", `<h1>Login required</h1><form data-ats="generic"><label>Email <input name="email"></label><label>Password <input type="password" name="password"></label><button type="submit">Log in</button></form>`);
  }
  if (variant === "mfa") {
    return html("MFA", `<div data-careeros-mfa="true" data-ats="generic"><h1>Two-factor authentication</h1><input name="otp" autocomplete="one-time-code"></div>`);
  }
  if (variant === "captcha") {
    return html("Captcha", `<div data-careeros-captcha="true" data-ats="generic"><h1>Verification</h1><div class="g-recaptcha"></div></div>`);
  }
  if (variant === "assessment") {
    return html("Assessment", `<div data-careeros-assessment="true" data-ats="generic"><h1>Timed coding assessment</h1><textarea name="challenge"></textarea></div>`);
  }
  if (variant === "widget") {
    return html("Widget", `<form data-ats="generic" data-careeros-step="1">${fields("g")}<div data-careeros-widget="unsupported" data-label="Custom calendar widget"></div><button type="button" data-careeros-next="true">Next</button></form>`);
  }
  if (variant === "success") {
    return html("Thanks", `<div data-careeros-marker="careeros-generic-success">Thank you. Application received.</div>`);
  }
  if (variant === "probable") {
    return html("Thanks", `<p>Thank you for applying. We have received your application.</p>`);
  }
  if (variant === "unverified") {
    return html("Unknown", `<p>Please wait.</p>`);
  }
  if (variant === "failed") {
    return html("Error", `<div data-provider-error="careeros-generic-error">Submission rejected</div>`);
  }
  if (variant === "actions") {
    return html(
      "Actions",
      `<div data-ats="generic">
        <button type="button" data-careeros-open="true">Apply</button>
        <button type="button" data-careeros-open="true">I'm interested</button>
      </div>
      <form data-ats="generic" data-careeros-step="1">
        ${fields("g")}
        <button type="button" data-careeros-next="true">Continue</button>
        <button type="button" data-careeros-next="true">Save &amp; Continue</button>
        <button type="button">Review</button>
        <button type="submit" data-careeros-final-submit="true">Submit application</button>
        <button type="button" data-careeros-cancel="true">Cancel</button>
      </form>`,
    );
  }
  return html(
    "Generic apply",
    `<form data-ats="generic" data-careeros-step="1" data-careeros-total-steps="2">
      ${fields("g")}
      <label>Ambiguous other <input name="g_other"></label>
      <button type="button" data-careeros-next="true">Next</button>
    </form>
    <script>
      document.querySelector('[data-careeros-next]').addEventListener('click', () => {
        const phone = document.querySelector('[name=g_phone]');
        if (phone && phone.value && phone.value.includes('(')) {
          const err = document.createElement('div');
          err.setAttribute('data-careeros-validation','true');
          err.setAttribute('data-field','g_phone');
          err.textContent = 'Phone format looks invalid';
          document.body.prepend(err);
          return;
        }
        document.querySelector('form').setAttribute('data-careeros-step','2');
        document.querySelector('[data-careeros-next]').remove();
        const submit = document.createElement('button');
        submit.setAttribute('data-careeros-final-submit','true');
        submit.textContent = 'Submit';
        submit.type = 'submit';
        document.querySelector('form').appendChild(submit);
      });
    </script>`,
  );
}

function providerPage(provider: string, search: URLSearchParams) {
  const variant = search.get("variant") || "form";
  const roots: Record<string, { root: string; success: string; error: string; extraClass: string }> = {
    greenhouse: { root: 'id="greenhouse-application" data-ats="greenhouse"', success: "gh-application-success", error: "gh-application-error", extraClass: "gh-question" },
    lever: { root: 'class="lever-apply-form" data-ats="lever"', success: "lever-application-success", error: "lever-application-error", extraClass: "lever-field" },
    ashby: { root: 'data-ashby-form="true" data-ats="ashby"', success: "ashby-application-success", error: "ashby-application-error", extraClass: "ashby-select" },
    workable: { root: 'data-ui="workable-application" data-ats="workable"', success: "workable-application-success", error: "workable-application-error", extraClass: "workable-step" },
    smartrecruiters: { root: 'class="smartr-widget" data-ats="smartrecruiters"', success: "sr-application-success", error: "sr-application-error", extraClass: "sr-screening" },
  };
  const spec = roots[provider];
  if (!spec) return html("Unknown", "<p>unknown provider</p>");
  if (variant === "success") {
    return html(`${provider} success`, `<div data-provider-success="${spec.success}">Application id: ${provider}-123 confirmed.</div>`);
  }
  if (variant === "wrong-success") {
    return html(
      `${provider} foreign success`,
      `<form ${spec.root}></form><div data-provider-success="lever-application-success">Thank you for applying.</div>`,
    );
  }
  if (variant === "error") {
    return html(`${provider} error`, `<div data-provider-error="${spec.error}">Submission rejected</div>`);
  }
  if (variant === "drift") {
    return html(`${provider} drift`, `<form data-ats="generic"><p>Broken ${provider} fixture</p><label>First name <input name="x"></label></form>`);
  }
  if (variant === "closed") {
    return html(`${provider} closed`, `<div data-ats="${provider}"><h1>This job is closed</h1><p>This job is no longer available.</p></div>`);
  }
  if (variant === "duplicate") {
    return html(`${provider} duplicate`, `<div data-ats="${provider}"><h1>Already applied</h1><p>You've already applied. An application already exists.</p></div>`);
  }
  if (variant === "open") {
    const cta = provider === "smartrecruiters" ? "I'm interested" : "Apply";
    return html(
      `${provider} job`,
      `<div data-ats="${provider}">
        <h1>${provider} job</h1>
        <p>Public job description. This is not the application form.</p>
        <button type="button" data-careeros-open="true">${cta}</button>
      </div>
      <script>
        document.querySelector('[data-careeros-open]').addEventListener('click', () => {
          window.location.href = '/${provider}?variant=form';
        });
      </script>`,
    );
  }
  if (variant === "final-step") {
    const prefix = provider.slice(0, 2);
    return html(
      `${provider} final`,
      `<form ${spec.root} data-careeros-step="2" class="${spec.extraClass}">
        ${fields(prefix)}
        <button type="button" data-careeros-next="true">Continue</button>
        <button type="button">Review</button>
        <button type="submit" data-careeros-final-submit="true">Submit application</button>
      </form>`,
    );
  }
  if (variant === "captcha-before-submit") {
    const prefix = provider.slice(0, 2);
    return html(
      `${provider} captcha`,
      `<form ${spec.root} data-careeros-step="1" class="${spec.extraClass}">
        ${fields(prefix)}
        <div class="g-recaptcha" data-careeros-captcha="true"></div>
        <button type="submit" data-careeros-final-submit="true">Submit application</button>
      </form>`,
    );
  }
  const prefix = provider.slice(0, 2);
  const drop = search.get("drop") === "1";
  const outcome = search.get("outcome");
  const action = drop
    ? `/submit/${provider}?drop=1`
    : outcome === "error"
      ? `/submit/${provider}?outcome=error`
      : `/submit/${provider}`;
  return html(
    `${provider} apply`,
    `<form ${spec.root} data-careeros-step="1" class="${spec.extraClass}" method="POST" action="${action}">
      ${fields(prefix)}
      <button type="submit" data-careeros-final-submit="true">Submit application</button>
    </form>
    <script>window.__CAREEROS_DROP=${drop ? "true" : "false"};</script>`,
  );
}

function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", FIXTURE_ORIGIN);
  if (req.method === "POST" && url.pathname.startsWith("/submit/")) {
    const provider = url.pathname.split("/")[2] ?? "generic";
    const id = url.searchParams.get("id") || "latest";
    submissions.set(`${provider}:${id}`, { received: true, dropped: url.searchParams.get("drop") === "1" });
    submitLog.push(provider);
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (url.searchParams.get("drop") === "1") {
        res.destroy();
        return;
      }
      if (url.searchParams.get("outcome") === "error") {
        res.writeHead(302, { Location: `/${provider}?variant=error` });
        res.end();
        return;
      }
      res.writeHead(302, { Location: `/${provider}?variant=success` });
      res.end();
    });
    return;
  }
  if (url.pathname === "/verify-received") {
    const provider = url.searchParams.get("provider") || "greenhouse";
    const hit = submissions.get(`${provider}:latest`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ received: Boolean(hit?.received), submitCount: submitLog.filter((item) => item === provider).length }));
    return;
  }
  if (url.pathname === "/careers/redirect-to-lever") {
    res.writeHead(302, { Location: "/lever" });
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (url.pathname === "/generic") return void res.end(genericPage(url.searchParams));
  if (url.pathname === "/greenhouse") return void res.end(providerPage("greenhouse", url.searchParams));
  if (url.pathname === "/lever") return void res.end(providerPage("lever", url.searchParams));
  if (url.pathname === "/ashby") return void res.end(providerPage("ashby", url.searchParams));
  if (url.pathname === "/workable") return void res.end(providerPage("workable", url.searchParams));
  if (url.pathname === "/smartrecruiters") return void res.end(providerPage("smartrecruiters", url.searchParams));
  res.end(html("fixtures", "<p>CareerOS application fixtures</p>"));
}

export function startFixtureServer(): Promise<{ close: () => Promise<void>; origin: string }> {
  const server = createServer(handle);
  return new Promise((resolve) => {
    server.listen(FIXTURE_PORT, "127.0.0.1", () => {
      resolve({
        origin: FIXTURE_ORIGIN,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

if (require.main === module) {
  void startFixtureServer().then(() => {
    console.log(`M24.5B fixtures listening on ${FIXTURE_ORIGIN}`);
  });
}
