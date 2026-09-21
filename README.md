# CareerOS

> A personal career operating system for managing the full job-search and career-growth workflow in one place.

CareerOS connects job discovery, opportunity analysis, tailored resumes,
application tracking, communication, LinkedIn growth, daily execution, weekly
review, and long-term career memory into one structured workflow.

**Discover → Analyze → Prepare → Apply → Track → Communicate → Build Visibility → Execute → Review → Remember → Improve**

The repository contains implementation through **M29 — Personal Experience
Hardening**. External integrations require configuration and provider access;
the presence of a feature does not mean live publishing or submission is enabled.

## Contents

- [Why CareerOS?](#why-careeros)
- [Product Workflow](#product-workflow)
- [Features](#features)
- [AI Philosophy](#ai-philosophy)
- [Privacy, Memory Controls & Data Export](#privacy-memory-controls--data-export)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Integration & Milestone Reference](#integration--milestone-reference)
- [Testing & Validation](#testing--validation)
- [Project Status & Known Limitations](#project-status--known-limitations)
- [Author](#author)

## Why CareerOS?

A job search often spreads across job boards, spreadsheets, resume files, notes,
LinkedIn, reminders, and AI tools. CareerOS brings those workflows together while
preserving the relationships between opportunities, evidence, applications, and
next actions.

An opportunity can inform which resume revision to prepare, which evidence is
missing, what belongs in today's plan, and what needs follow-up. Weekly reviews
and career memory add context for future decisions without replacing the
underlying records.

The goal is to turn career activity into a structured decision system.

## Product Workflow

```text
Discover and analyze opportunities
                ↓
Prepare a job-specific resume and application package
                ↓
Apply, track progress, and follow up
                ↓
Build visibility through LinkedIn content
                ↓
Plan daily actions and review weekly progress
                ↓
Retain useful career context and improve future decisions
```

These are connected workflows, not mandatory sequential steps. Users can work
with each domain independently.

## Features

### Job Discovery & Opportunity Intelligence

Discovery profiles, discovery runs, and application queues separate evaluating
opportunities from recording active applications. Opportunity analysis connects
job requirements to career evidence, highlights gaps and eligibility checks, and
supports preparation decisions. The aggregate opportunity score uses a
deterministic weighted calculation.

### Job-Specific Resume Versions

Resume versions and immutable revisions preserve the content used for a specific
role. When an application moves to `APPLIED`, its submission snapshot is finalized
so later resume or job edits do not rewrite the historical application context.

### Application Tracking & Assisted Execution

Applications keep an event history and explicit stage transitions:

```text
DRAFT → APPLIED → SCREENING → ASSESSMENT → INTERVIEW → OFFER → ACCEPTED
```

Stages can be skipped where allowed. `REJECTED` and `WITHDRAWN` are terminal
outcomes; the state machine controls which transitions are available.

Prepared application packages and execution sessions support browser-assisted
external applications. Confirmed submission is **disabled by default** and requires
global, provider, and trusted runtime capability gates. If those checks fail,
the user completes submission manually. An uncertain result must not be treated
as a confirmed success.

### Communication & LinkedIn Growth

Communication drafts support application-related messages and follow-up, with
revision history. Copying a draft does not mark it as used.

LinkedIn workflows include strategy, content pillars, ideas, drafts, factual QA,
publishing plans, and performance records. Manual Copy / Mark Published remains
available alongside the optional official OAuth/API integration. Official
publishing uses the approved plan's frozen revision; optional member analytics
require additional provider approval.

### Today — Daily Career Roadmap

Route: `/workspace/today`

A focused daily plan prioritizes career actions using urgency, career impact,
readiness, opportunity quality, momentum, and effort. Career days and streaks
follow the user's timezone and scheduled weekdays.

Login, page views, refreshing a roadmap, and copying text do not count as
meaningful activity. Completing a task on Today does not automatically change
the underlying application or other domain record.

### Weekly Review & Career Momentum

Route: `/workspace/review`

Weekly reviews summarize recorded activity and identify priorities for the next
week. Career Momentum is a personal execution/progress indicator, not a hiring
probability.

| Component | Weight |
| --- | ---: |
| Execution consistency | 25 |
| Application progress | 25 |
| Opportunity pipeline | 20 |
| Visibility / networking | 15 |
| Skills / evidence growth | 15 |

`NO_ACTIVITY` can score zero; `NOT_APPLICABLE` is excluded from the denominator.
Finalized review metrics and content remain fixed. Adopt/Dismiss decisions can
still be made after finalization.

### AI Memory & Knowledge Graph

Route: `/workspace/memory`

Structured career memory records facts, preferences, goals, evidence, patterns,
constraints, and milestones with provenance and confidence. Explainable graph
relationships connect relevant career concepts.

Users can correct, suppress, or delete memory and rebuild it from recent history.
Memory supplies context; source domain records remain authoritative. Disabling
memory stops retrieval and new derived memory while the core workspace remains
available.

### Settings & Data Export

Route: `/workspace/settings`

Settings group access to career planning, integrations, memory/privacy, provider
status, and user-owned JSON export. Domain pages remain the source of truth for
their own settings.

## AI Philosophy

CareerOS separates deterministic domain decisions from AI assistance. AI supports
analysis, drafting, summaries, and explanation. Application transitions, weekly
Momentum calculations, and memory confidence are handled by application logic.

For Today, weekly review, and career memory, AI wording must not rewrite the
underlying scores or facts. Those workflows include deterministic fallback text.
AI-backed generation still needs an API key and a model available to the
configured OpenAI project.

## Privacy, Memory Controls & Data Export

Server-side ownership checks scope records to the signed-in user. The LinkedIn
integration includes OAuth state checks and encrypted token storage. Memory
retains provenance and offers explicit user controls.

**Settings → Data & Export** produces JSON containing selected profile,
resume/revision metadata, jobs, applications, communication and LinkedIn metadata,
roadmaps, reviews, career memory, and graph summaries. Export reads records in
batches rather than inheriting workspace list limits. It is a data-portability
export, not a full database backup or an import/restore feature.

Authentication internals and provider credentials are excluded by the export
implementation. Exported career data is still personal data and should be stored
privately.

Delete All sets a memory reset boundary so normal refresh does not reconstruct
older history. An explicit Rebuild can reprocess the recent 12-week window.

## Technology Stack

| Concern | Installed technology |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 3 |
| ORM / database | Prisma 7 + PostgreSQL (`pg` adapter) |
| Authentication | Better Auth |
| AI | OpenAI SDK |
| Resume parsing | `pdf-parse` + Mammoth |
| Assisted browser execution | Playwright / Chromium |
| 3D / graphics | Three.js + React Three Fiber + Drei |

[package.json](package.json) lists direct dependencies and scripts;
[package-lock.json](package-lock.json) records the resolved versions. Zod,
React Hook Form, Framer Motion, and Zustand are not currently declared as direct
dependencies.

## Architecture

CareerOS uses a **modular monolith**: one Next.js application with domain-specific
features, shared UI, and server-side infrastructure. Today, weekly review, and
career memory read domain records through integration points; AI does not replace
the database as the source of truth.

<details>
<summary>Repository structure and layering conventions</summary>

### Folder Structure

The main directories are:

```text
prisma/                   # Database schema and versioned migrations
scripts/                  # Milestone QA, security, and browser checks
src/
├── app/                  # App Router pages and API route handlers
├── components/           # Shared UI, workspace shell, command palette, Core, and 3D
├── features/             # Product domains
│   ├── auth/             # Authentication UI and client
│   ├── onboarding/       # First-run experience
│   ├── resume/           # Resume analysis, versions, and revisions
│   ├── jobs/             # Job discovery, matching, and application queue
│   ├── applications/     # Application tracking and events
│   ├── application-packages/  # Application preparation and review
│   ├── application-execution/ # Assisted browser execution and ATS fixtures
│   ├── communications/   # Communication drafts and revisions
│   ├── linkedin/         # Content planning and official API integration
│   ├── skills/           # Skills insights
│   ├── analytics/        # Career analytics
│   ├── report/           # Career reports
│   ├── daily-roadmap/    # Today plan and streaks (M26)
│   ├── weekly-review/    # Weekly review and Momentum (M27)
│   ├── career-memory/    # Career memory and knowledge graph (M28)
│   ├── settings/         # Settings and data export (M29)
│   └── ...               # Core, shared, landing, workspace, and analysis
├── generated/prisma/     # Generated Prisma client
├── server/               # Shared server-side AI, database, and auth infrastructure
├── config/               # Design-system configuration
├── styles/               # Shared styles and tokens
├── hooks/                # Shared hook directory
├── lib/                  # Shared utility directory
└── types/                # Shared type directory
```

### Layering rules (intended)

- **`app/`** wires routes to features; it stays thin.
- **`features/*`** own their domain logic and compose `components/*`. Features should
  not import from one another directly — share through `lib/`, `types/`, or
  `server/` instead, to keep modules decoupled.
- **`components/*`** are reusable and feature-agnostic (`ui` is the dumbest layer).
- **`server/*`** is server-only (DB, auth, AI). The client must never import it.
- **`lib/`** holds pure, client-safe helpers with no feature knowledge.


- **Import alias:** `@/*` maps to `src/*`.
- Some placeholder directories retain `.gitkeep` files.
- Regenerate the Prisma client after schema changes.

</details>

## Getting Started

### Prerequisites

- Node.js **20.19+ (20.x)**, **22.12+ (22.x)**, or **24+**, matching the locked Prisma 7 requirements.
- npm and a running PostgreSQL database.
- An OpenAI API key for AI-backed features; LinkedIn credentials only for the optional official integration.

### Local setup

1. Clone the repository and install the locked dependencies:

   ```bash
   git clone https://github.com/omarm5238/CareerOS.git
   cd CareerOS
   npm ci
   ```

2. Create a `.env` file in the repository root. Both Prisma and the QA scripts
   load this file; Next.js also reads it. Replace the example values with your
   local configuration:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/careeros"
   BETTER_AUTH_SECRET="replace-with-a-generated-secret"
   BETTER_AUTH_URL="http://localhost:3000"

   # Required only for AI-backed features.
   OPENAI_API_KEY=""
   # Set this to a model available to your OpenAI project, or leave empty
   # to use the application default in src/server/ai/config.ts.
   OPENAI_MODEL=""
   ```

   Generate an authentication secret with:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Keep `.env` private; environment files are already ignored by Git.

3. Apply the committed migrations and regenerate the Prisma client:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000), create an account, and complete
onboarding. For a production build, run `npm run build` followed by `npm run start`
with the required environment configured.

For assisted application execution, install Chromium and follow the runtime
requirements below. LinkedIn connection and publishing need the separate
configuration documented under M25B.

## Integration & Milestone Reference

<details>
<summary>Optional AI model and timeout settings</summary>

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

</details>

<details>
<summary>Detailed milestone behavior, provider configuration, and execution gates</summary>

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

### Milestone 26 — Daily Roadmap + Career Streak

M26 is the daily operating layer. It answers what to do today by reading existing
CareerOS domain truth from resume, applications, jobs, communications, and LinkedIn.
It does **not** replace those systems.

Route: `/workspace/today`

Philosophy: 3–5 core actions, Top 3 highlighted, quality over backlog. One roadmap
per user per local career day (`unique(userId, localDate)`). Historical roadmaps keep
the timezone they were created with.

Timezone uses IANA identifiers (`Europe/Istanbul`, `UTC`). Career days and streaks
are local to the user, not raw UTC. Default timezone is UTC until the user sets one.
Active weekdays default to Monday–Friday. Inactive weekdays do not break streak
continuity; a missed scheduled day does.

Priority is deterministic (100 points):

| Component | Points |
| --- | --- |
| Urgency | 30 |
| Career impact | 25 |
| Readiness | 15 |
| Opportunity quality (stored) | 15 |
| Momentum / neglect | 10 |
| Effort efficiency | 5 |

AI (`OPENAI_DAILY_ROADMAP_MODEL`) may only rewrite wording. It cannot change scores,
selected entities, or invent deadlines. If AI fails, deterministic fallback remains.

Manual Complete on Today never mutates domain state (an Apply task does not set
`Application.status = APPLIED`). Actual domain events can reconcile the matching
roadmap action to `COMPLETED` with `completionSource = DOMAIN_EVENT`.

Meaningful activity is idempotent (`unique(userId, fingerprint)`). Login, page view,
roadmap generate/refresh, copy, and job dismiss do not count. Streak = consecutive
scheduled career days with at least one meaningful activity.

M26 exposes current/longest streak and this week's active/scheduled days.
Weekly review, Career Momentum, and week-over-week strategy are implemented
separately in M27.

There is no cron, Redis, BullMQ, or background roadmap generation.

```bash
npm run m26:qa
npm run m26:security
npm run m26:headed
```

### Milestone 27 — Weekly Review + Career Momentum

M27 is the weekly operating review. It answers what moved forward, what stalled,
where execution gained or lost momentum, and what should change next week.

It reads M21–M26 facts. It does **not** mutate applications, resumes, communications,
LinkedIn, jobs, daily actions, or streak records.

Route: `/workspace/review` and `/workspace/review/[reviewId]`

Weeks are local Monday 00:00 through Sunday 23:59:59.999 in the stored IANA
timezone from M26 preferences. Current week stays `DRAFT` and can refresh.
A completed week can be explicitly `FINALIZED`. Finalized metrics, scores, insight
content, and recommendation content never silently rewrite. Adopt/Dismiss remain
allowed after finalization because they are user decisions.

Career Momentum is a personal 0–100 execution/progress indicator, not a hiring or
employability probability.

| Component | Weight |
| --- | --- |
| Execution consistency | 25 |
| Application progress | 25 |
| Opportunity pipeline | 20 |
| Visibility / networking | 15 |
| Skills / evidence growth | 15 |

`NOT_APPLICABLE` is excluded from the denominator. `NO_ACTIVITY` stays applicable and
can score zero. If no components apply, the overall score is empty rather than fake 0.

AI (`OPENAI_WEEKLY_REVIEW_MODEL`) may only rewrite wording. Invalid models fall back
to deterministic text without changing metrics, scores, insight types, or recommendation
intent.

Adopted recommendations can inform the next M26 Today plan as `SYSTEM_RECOMMENDED`
candidates. Adoption does not execute domain actions. M26 still revalidates current
truth, caps handoff at 3, and keeps hard urgency first.

Long-term AI memory and the knowledge graph are owned by M28, separately from M27.

```bash
npm run m27:qa
npm run m27:security
npm run m27:headed
```

### Milestone 28 — AI Memory + Knowledge Graph

M28 stores structured long-term career memory with provenance, confidence, aging,
contradiction handling, user control, and a small knowledge graph.

Source of truth remains M21–M27. Memory provides context only. It cannot change
application status, resume READY, job scores, communication USED, LinkedIn publish
state, daily completion, or weekly Momentum scores.

Six models: `careerMemory`, `careerMemoryEvidence`, `careerGraphEntity`,
`careerGraphRelation`, `careerMemoryEvent`, `careerMemoryPreference`.

Confidence is evidence strength (`LOW` / `MEDIUM` / `HIGH`), not probability.

Source precedence: USER_CORRECTED > USER_DECLARED > direct domain event >
repeated derived pattern > single derived signal. Duplicate evidence fingerprints
cannot inflate confidence.

Aging (unless user-declared/corrected): evidence signals 90 days, career patterns
60 days, behavior patterns 45 days, derived focus 60 days. Preferences, goals,
constraints, and milestones persist until superseded or deleted.

Suppressed claims are not regenerated from old evidence. Delete All sets
`memoryResetAt`. Normal refresh will not rebuild from history before that
timestamp. Explicit Rebuild may reprocess the recent 12-week bound.

When `memoryEnabled=false`, retrieval is empty and no new derived memory is
created. Core CareerOS keeps working.

M26 may add at most +5 contextual points and grounded whyNow text. Hard urgency
always wins. M27 may enrich wording only.

AI (`OPENAI_CAREER_MEMORY_MODEL`) may phrase text. It cannot set confidence,
resolve conflicts, delete, suppress, or invent facts. Invalid models fall back.

Route: `/workspace/memory`

M29 consolidates global settings discoverability. M28 owns the memory/privacy controls.

```bash
npm run m28:qa
npm run m28:security
npm run m28:headed
```

### Milestone 29 — Personal Experience Hardening

M29 is the final Phase-2 polish milestone. It does not add a product domain.
It hardens visual consistency, responsive/accessibility basics, bounded queries,
settings discoverability, user-owned JSON export, and security.

Settings remain a grouped entry point at `/workspace/settings`. Domain pages stay
the source of truth for Career Planning, Integrations, Memory & Privacy, and
provider status.

#### Backup / data portability

Signed-in users can export a JSON backup from **Settings → Data & Export**.

The file uses this root:

```json
{
  "schemaVersion": "m29.1",
  "exportedAt": "...",
  "careerOSVersion": "0.1.0",
  "data": {}
}
```

Included: profile/preferences metadata, resume/revision metadata, jobs and
discovery/queue metadata, applications and events, communication metadata,
LinkedIn post/publishing metadata, Today/activity, weekly reviews, career
memory, and graph summaries. The JSON export includes all safe records owned
by the signed-in user. Workspace list views stay bounded for performance;
export paginates in batches instead of inheriting those `take` limits.

Never included: passwords, session tokens, OAuth/refresh tokens, API keys,
authorization codes, encryption keys, or Better Auth internals. Export is
always scoped to the signed-in session user.

```bash
npm run m29:qa
npm run m29:security
npm run m29:headed
```

</details>

## Testing & Validation

After configuring a development/test database and generating the Prisma client:

```bash
npx prisma validate
npx prisma migrate status
npm run lint
npm run build
npm run m29:qa
npm run m29:security
```

For the headed browser checks, install Chromium, start the app, then run:

```bash
npx playwright install chromium
npm run m29:headed
```

These are commands to run in the configured environment, not recorded test results.

<details>
<summary>All available npm scripts</summary>

### Scripts

The milestone QA scripts need the configured database and generated Prisma client.
Use a development/test database: several scripts create fixture users and records.
Headed browser checks also need Chromium and a running app.

| Script          | Description                |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Production build           |
| `npm run start` | Run the production build   |
| `npm run lint`  | Lint with ESLint           |
| `npm run m245b:fixtures` | Start local ATS fixtures (dev/QA only) |
| `npm run m245c:qa` | M24.5C confirmed-submit gate QA |
| `npm run m245c:live` | M24.5C live provider validation |
| `npm run m25a:qa` | M25A LinkedIn growth QA |
| `npm run m25a:headed` | M25A headed UI checks |
| `npm run m25b:qa` | M25B fixture connection/publishing QA |
| `npm run m25b:security` | M25B OAuth/token/ownership security QA |
| `npm run m25b:live` | Safe live smoke (no publish) |
| `npm run m25b:headed` | M25B headed 390×844 + desktop checks |
| `npm run m26:qa` | M26 daily roadmap + streak QA |
| `npm run m26:security` | M26 ownership and forgery QA |
| `npm run m26:headed` | M26 headed Today + 390×844 checks |
| `npm run m27:qa` | M27 weekly review + momentum QA |
| `npm run m27:security` | M27 ownership and forgery QA |
| `npm run m27:headed` | M27 headed Review + 390×844 checks |
| `npm run m28:qa` | M28 memory + knowledge graph QA |
| `npm run m28:security` | M28 ownership and forgery QA |
| `npm run m28:headed` | M28 headed Memory + 390×844 checks |
| `npm run m29:qa` | M29 hardening, export, dataset, and regression QA |
| `npm run m29:security` | M29 export/settings ownership and secret QA |
| `npm run m29:headed` | M29 Phase-2 E2E + 390×844 checks |

</details>

## Project Status & Known Limitations

The repository includes the Phase 2 implementation through **M29**, along with
milestone QA and security scripts. This is a description of the source tree,
not a claim that all tests or live integrations have been validated in every
environment. The package version is currently `0.1.0`; no GitHub Release is
currently published.

| Milestones | Implemented scope |
| --- | --- |
| M21–M22 | Job-specific resume versions and application tracking |
| M23–M24 | Job discovery, application queues, and communication drafts |
| M24.5A–M24.5C | Opportunity intelligence, preparation, assisted execution, and submit gates |
| M25A–M25B | LinkedIn growth and official connection/publishing workflows |
| M26–M27 | Daily roadmap, streaks, weekly review, and Momentum |
| M28 | Career memory and knowledge graph |
| M29 | Experience hardening, settings, and paginated data export |

Current boundaries:

- Assisted browser execution needs a long-lived Node process and Chromium; it is
  not suitable for a serverless-only deployment.
- Confirmed external submission remains gated by provider validation and session
  capability. A visible submit button alone is not enough.
- LinkedIn publishing requires official credentials and permissions; analytics
  need separate approval. Manual fallback remains available.
- JSON export contains selected user data and metadata; it is not a complete
  file archive or a restore mechanism.
- The current product emphasizes personal career workflows. Organization and
  team collaboration are not described as shipped capabilities.
- Responsive and accessibility checks exist, but no formal WCAG certification
  is claimed.

### Possible Future Directions

Deployment hardening, additional providers, richer analytics, collaboration, and
expanded export/import workflows are possible future work, not committed
features or release promises.

### Repository Safety & License

Keep environment files, API keys, OAuth credentials, database credentials,
private user data, and personal exports out of version control. Follow the
environment setup above; this repository does not currently include an
`.env.example` file.

No license file is currently included in the repository.

## Author

**Omar Mohamed Hassan** — Software Engineering

CareerOS is a personal project exploring how structured software systems,
deterministic decision logic, and AI assistance can improve career-management
workflows.
