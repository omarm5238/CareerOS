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

### Scripts

| Script          | Description                |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Production build           |
| `npm run start` | Run the production build   |
| `npm run lint`  | Lint with ESLint           |

---

## Project Conventions

- **Import alias:** `@/*` maps to `src/*` (e.g. `import { Button } from "@/components/ui/button"`).
- **Empty folders** are tracked with `.gitkeep` files that also document each folder's purpose.

## Status

Scaffold only — initialized project + folder architecture. Awaiting review before
any features are built.
