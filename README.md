# CareerOS

**CareerOS is not a resume builder, chatbot, or job board.**

CareerOS is a **Career Operating System** that helps users manage resumes, jobs,
skills, analytics, and career growth through one intelligent workspace.

> This repository currently contains **only the architecture scaffold**. No business
> logic, product features, database schema, authentication, or AI analysis have been
> implemented yet.

---

## Tech Stack

| Concern        | Choice                                            |
| -------------- | ------------------------------------------------- |
| Framework      | Next.js (App Router)                              |
| Language       | TypeScript                                        |
| Styling        | Tailwind CSS                                       |
| ORM            | Prisma                                            |
| Database       | PostgreSQL                                        |
| Auth           | Better Auth                                       |
| Validation     | Zod                                               |
| Forms          | React Hook Form                                   |
| Animation      | Framer Motion                                     |
| 3D / Graphics  | Three.js · React Three Fiber · Drei               |
| Client state   | Zustand (only when necessary)                     |

> Note: the scaffold's `package.json` currently installs only the Next.js + TypeScript
> + Tailwind toolchain needed to boot the app. The remaining libraries above are part
> of the intended stack and will be added as their corresponding layers are built.

## Architecture Style

**Modular Monolith.** A single deployable Next.js application, internally organized
into well-isolated modules (features) and clear layers (UI, feature, server).
**No microservices in v1.**

---

## Folder Structure

```
src/
├── app/                  # Next.js App Router: routes, layouts, route handlers
├── components/           # Shared, cross-feature React components
│   ├── ui/               # Presentational primitives (buttons, inputs, dialogs)
│   ├── workspace/        # Workspace shell/layout components (panels, toolbars)
│   └── three/            # 3D components (Three.js / R3F / Drei)
├── features/             # Self-contained product domains (the modular monolith)
│   ├── core/             # Cross-cutting feature logic shared across domains
│   ├── onboarding/       # User onboarding flows and first-run experience
│   ├── auth/             # Authentication UI/flows (client side)
│   ├── resume/           # Resume management
│   ├── workspace/        # Central workspace experience
│   ├── analysis/         # Resume/job analysis & insights
│   ├── jobs/             # Job tracking & pipeline
│   ├── skills/           # Skills tracking & growth
│   └── analytics/        # Career analytics & reporting
├── hooks/                # Shared, reusable React hooks used across features
├── lib/                  # Framework-agnostic, client-safe utilities/helpers
├── server/               # Server-only code (never imported by the client)
│   ├── ai/               # AI integrations & orchestration
│   ├── db/               # Prisma client & data access (PostgreSQL)
│   └── auth/             # Better Auth server config & sessions
├── types/                # Shared TypeScript / Zod-inferred types
├── styles/               # Global styles, design tokens, Tailwind layers
└── config/               # App configuration, constants, env access
```

### Layering rules (intended)

- **`app/`** wires routes to features; it stays thin.
- **`features/*`** own their domain logic and compose `components/*`. Features should
  not import from one another directly — share through `lib/`, `types/`, or
  `server/` instead, to keep modules decoupled.
- **`components/*`** are reusable and feature-agnostic (`ui` is the dumbest layer).
- **`server/*`** is server-only (DB, auth, AI). The client must never import it.
- **`lib/`** holds pure, client-safe helpers with no feature knowledge.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Optional Career Brief AI settings

The CareerOS Brief uses `OPENAI_MODEL` by default. These optional overrides tune
the primary and compact retry attempts:

```bash
OPENAI_ANALYTICS_MODEL="gpt-4.1-mini"
OPENAI_ANALYTICS_FAST_MODEL="gpt-4.1-mini"
OPENAI_ANALYTICS_TIMEOUT_MS="45000"
OPENAI_ANALYTICS_RETRY_TIMEOUT_MS="25000"

# Optional job-match overrides. Defaults: primary 45s, compact retry 25s.
OPENAI_JOB_MATCH_MODEL=""
OPENAI_JOB_MATCH_FAST_MODEL=""
OPENAI_JOB_MATCH_TIMEOUT_MS="45000"
OPENAI_JOB_MATCH_RETRY_TIMEOUT_MS="25000"

# Optional communication generation override.
OPENAI_COMMUNICATIONS_MODEL=""

# Optional opportunity intelligence override.
OPENAI_OPPORTUNITY_MODEL=""

# Optional assisted-application free-text override.
OPENAI_APPLICATION_EXECUTION_MODEL=""

# Optional LinkedIn growth generation override (M25A).
OPENAI_LINKEDIN_MODEL=""
```

### Milestone 24.5B — External Application Execution

Assisted browser execution is **not serverless-friendly**. It needs a long-lived
Node process, Chromium, and in-memory browser sessions.

```bash
npx playwright install chromium
```

Product execution defaults to a **headed** Chromium window (`headless: false`).
Set `CAREEROS_BROWSER_HEADLESS=1` only for automated environments.

### Confirmed browser submit kill switches (M24.5C)

Confirmed submit is **disabled by default**. A fresh CareerOS install does not
gain live confirmed submit just because this code is deployed.

CareerOS may still assist with filling a public application form. If any gate
fails, final submission must be completed **manually** in the application
browser.

Confirmed submit requires **all three**:

1. Global switch enabled
2. Provider switch enabled
3. Runtime session capability trusted for that specific live form

```bash
# Global kill switch. Unset / any value other than 1|true|yes = disabled.
CAREEROS_CONFIRMED_BROWSER_SUBMIT=1

# Provider switches. Each defaults to disabled.
CAREEROS_SUBMIT_GREENHOUSE=1
CAREEROS_SUBMIT_LEVER=1
CAREEROS_SUBMIT_ASHBY=1
CAREEROS_SUBMIT_WORKABLE=1
CAREEROS_SUBMIT_SMARTRECRUITERS=1
```

Accepted enabled values: `1`, `true`, or `yes` (case-insensitive).

The Generic adapter can never confirmed-submit. Provider environment flags
cannot override Generic to true.

Public live inspection is **not** enough to enable a provider. Without a
sandbox, demo tenant, or other controlled submit environment, dedicated
providers remain ineligible even when their final button is visible.

Do not treat this as a mass auto-apply system. Final submit is always a
specific user action for one application.

Controlled ATS fixtures (never used in production navigation):

```bash
npm run m245b:fixtures
```

### Milestone 25A — LinkedIn Growth System

M25A prepares and decides LinkedIn strategy, ideas, drafts, factual QA,
publishing plans, and manual performance. It does **not** connect to LinkedIn.

There is no LinkedIn OAuth, login, scraping, browser automation, or automatic
publishing. Copy is not publication. Mark Published is an explicit user
confirmation (`USER_CONFIRMED`). Performance snapshots are manual until M25B.

```bash
npm run m25a:qa
```

### Milestone 25B — Official LinkedIn Connection + Verified Publishing

M25B adds official LinkedIn OAuth/OIDC connection and exact-revision official
publishing on top of M25A. CareerOS uses official LinkedIn APIs only. There is
no scraping, browser automation, password/cookie capture, DMs, likes, comments,
connection requests, or background/mass publishing.

M25A still owns content. Official publish always uses the frozen publishing-plan
revision (`linkedinPostRevisionId`), never the post's later `activeRevisionId`.
No AI runs between an approved plan and the LinkedIn create call.

If LinkedIn may have received a post but CareerOS cannot verify the result, the
attempt becomes `UNCERTAIN`. CareerOS does not retry that create call.

Optional member analytics require additional LinkedIn API approval. When
approval is absent, the UI stays informational and M25A manual metrics remain.

Required environment variables (server-only; never commit secrets):

| Variable | Purpose |
| --- | --- |
| `LINKEDIN_CLIENT_ID` | Official LinkedIn app client id |
| `LINKEDIN_CLIENT_SECRET` | Official LinkedIn app secret |
| `LINKEDIN_REDIRECT_URI` | OAuth callback, typically `/api/linkedin/connection/callback` |
| `LINKEDIN_TOKEN_ENCRYPTION_KEY` | 32-byte AES-GCM key as 64-char hex or base64 |
| `LINKEDIN_API_BASE_URL` | Optional API host override |
| `CAREEROS_LINKEDIN_PROVIDER` | `fixture` for QA only. Production default is `official` |
| `CAREEROS_LINKEDIN_ANALYTICS_APPROVED` | Set `1` only if the app actually has analytics approval |
| `CAREEROS_LINKEDIN_ALLOW_LIVE_TEST_PUBLISH` | Never enable in normal QA. Live publish still requires explicit user authorization |

```bash
npm run m25b:qa
npm run m25b:security
npm run m25b:live
```

`m25b:live` never publishes. If LinkedIn credentials are absent it reports
`LIVE_NOT_CONFIGURED`. That does not block Core architecture.

Manual M25A Copy / Mark Published remains available when LinkedIn is
disconnected, missing publish permission, or needs reconnect.

### Scripts

| Script          | Description                |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Production build           |
| `npm run start` | Run the production build   |
| `npm run lint`  | Lint with ESLint           |
| `npm run m245b:fixtures` | Start local ATS fixtures (dev/QA only) |
| `npm run m25a:qa` | M25A LinkedIn growth QA |
| `npm run m25a:headed` | M25A headed UI checks |
| `npm run m25b:qa` | M25B fixture connection/publishing QA |
| `npm run m25b:security` | M25B OAuth/token/ownership security QA |
| `npm run m25b:live` | Safe live smoke (no publish) |
| `npm run m25b:headed` | M25B headed 390×844 + desktop checks |

---

## Project Conventions

- **Import alias:** `@/*` maps to `src/*` (e.g. `import { Button } from "@/components/ui/button"`).
- **Empty folders** are tracked with `.gitkeep` files that also document each folder's purpose.

## Status

Scaffold only — initialized project + folder architecture. Awaiting review before
any features are built.
