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
```

### Milestone 24.5B — External Application Execution

Assisted browser execution is **not serverless-friendly**. It needs a long-lived
Node process, Chromium, and in-memory browser sessions.

```bash
npx playwright install chromium
```

Product execution defaults to a **headed** Chromium window (`headless: false`).
Set `CAREEROS_BROWSER_HEADLESS=1` only for automated environments.

Controlled ATS fixtures (never used in production navigation):

```bash
npm run m245b:fixtures
```

Do not treat this as a mass auto-apply system. Final submit is always a
specific user action for one application.

### Scripts

| Script          | Description                |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Production build           |
| `npm run start` | Run the production build   |
| `npm run lint`  | Lint with ESLint           |
| `npm run m245b:fixtures` | Start local ATS fixtures (dev/QA only) |

---

## Project Conventions

- **Import alias:** `@/*` maps to `src/*` (e.g. `import { Button } from "@/components/ui/button"`).
- **Empty folders** are tracked with `.gitkeep` files that also document each folder's purpose.

## Status

Scaffold only — initialized project + folder architecture. Awaiting review before
any features are built.
