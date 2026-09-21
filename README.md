# CareerOS

A personal career operating system for managing the full job-search and career-growth workflow in one place.

CareerOS connects job discovery, opportunity analysis, tailored resumes, application tracking, communication, LinkedIn growth, daily execution, weekly review, and long-term career memory into one structured workspace.

Instead of treating a job search as a pile of disconnected tasks, CareerOS keeps those pieces in a continuous operating loop:

**Discover → Analyze → Prepare → Apply → Track → Communicate → Build Visibility → Execute → Review → Remember → Improve**

The repository contains implementation through **M29 — Personal Experience Hardening**. External integrations require configuration and provider access; the presence of a feature does not mean live publishing or submission is enabled.

---

## Why CareerOS?

A serious job search usually lives across several disconnected systems:

- job boards
- spreadsheets
- resume files
- notes
- application trackers
- LinkedIn
- reminders
- AI tools
- follow-up messages

CareerOS brings those workflows together and preserves the relationships between them.

A single opportunity can influence which resume version to use, which evidence is missing, whether the role is ready to apply to, what belongs on today's roadmap, what should be followed up later, what the weekly review should measure, and what CareerOS should remember over time.

The goal is not only to track activity. The goal is to turn career work into a structured decision system.

---

## Product workflow

```text
Job Discovery
      ↓
Opportunity Intelligence
      ↓
Job-Specific Resume
      ↓
Application Package
      ↓
Application Execution
      ↓
Application Tracking
      ↓
Communication & Follow-Up
      ↓
LinkedIn Growth
      ↓
Daily Career Roadmap
      ↓
Weekly Career Review
      ↓
AI Memory + Knowledge Graph
      ↓
Better Future Decisions
```

These are connected workflows, not mandatory sequential steps. You can work with each domain independently.

---

## Screenshots

### Today — Daily Career Roadmap

![CareerOS Today](docs/screenshots/today.png)

Daily actions prioritized by urgency, career impact, readiness, opportunity quality, momentum, and effort.

### Job Discovery & Opportunity Intelligence

![CareerOS Jobs](docs/screenshots/jobs.png)

Review discovered opportunities, evaluate suitability, and prepare strong roles for application.

### Application Tracker

![CareerOS Applications](docs/screenshots/applications.png)

Track application progress through a structured, event-based lifecycle.

### LinkedIn Growth

![CareerOS LinkedIn](docs/screenshots/linkedin.png)

Plan, prepare, publish, and review LinkedIn content with a structured growth workflow.

### Weekly Review

![CareerOS Weekly Review](docs/screenshots/review.png)

A factual weekly snapshot covering execution, applications, opportunity pipeline, visibility, and skills or evidence growth.

### Career Memory

![CareerOS Memory](docs/screenshots/memory.png)

Long-term career context with evidence provenance, confidence, corrections, suppression, and knowledge-graph relationships.

### Settings

![CareerOS Settings](docs/screenshots/settings.png)

Grouped workspace controls for planning, integrations, memory and privacy, provider status, export, and account.

---

## Features

### Job Discovery

CareerOS separates discovery from active applications.

It supports:

- job discovery profiles
- discovery runs
- an opportunity queue
- structured suitability signals
- strong-opportunity prioritization
- preparation states
- duplicate detection
- already-applied detection

Opportunities can be evaluated before they become applications.

### Opportunity Intelligence

CareerOS can analyze a role against existing career evidence, including:

- job requirements
- matching evidence
- evidence gaps
- preparation status
- suitability
- application readiness

Core opportunity scoring remains deterministic. AI may help with wording or interpretation, but it does not decide factual eligibility or system state.

### Job-specific resume versions

CareerOS keeps job-specific resume versions with immutable revision history:

- resume versions
- immutable revisions
- READY status
- revision history
- application-linked resume snapshots

Once an application is submitted, the exact resume revision used can stay associated with that application.

### Application Tracker

Applications follow an event-based lifecycle:

```text
DRAFT
APPLIED
SCREENING
ASSESSMENT
INTERVIEW
OFFER
ACCEPTED
REJECTED
WITHDRAWN
```

Event history is preserved, so later status changes do not erase earlier progress.

### External Application Execution

CareerOS includes an execution layer for supported external application workflows:

- execution sessions
- prepared application packages
- browser-assisted application flows
- submission attempts
- explicit submit boundaries
- uncertain-submission handling
- provider capability validation

CareerOS does not report a successful external submission unless that workflow has actually been validated.

### Communication and follow-up

CareerOS can manage communication such as:

- follow-up messages
- recruiter outreach
- thank-you messages
- application communication

Drafts use immutable revisions. Copying a draft does not automatically mark it as used.

### LinkedIn Growth

CareerOS includes a dedicated LinkedIn workflow:

- content pillars
- content ideas
- post drafting
- immutable post revisions
- factual QA
- publishing plans
- publication tracking
- performance tracking
- visibility insights
- manual publishing
- official LinkedIn integration architecture

Where official provider access is unavailable, CareerOS keeps that capability explicitly gated rather than simulating success.

### Today — Daily Career Roadmap

Route: `/workspace/today`

CareerOS turns current career data into a focused daily plan. Actions can include reviewing a job, preparing an opportunity, applying, following up, preparing for an interview, improving a resume, publishing on LinkedIn, building evidence, developing a skill, or improving a profile.

Daily priority is based on:

- urgency
- career impact
- readiness
- opportunity quality
- momentum / neglect
- effort efficiency

CareerOS also tracks meaningful career activity. Opening the app, refreshing a page, or copying text does not count.

### Weekly Review and Career Momentum

Route: `/workspace/review`

CareerOS builds weekly factual reviews from real activity. Career Momentum is divided into five components:

| Component | Weight |
|---|---:|
| Execution Consistency | 25 |
| Application Progress | 25 |
| Opportunity Pipeline | 20 |
| Visibility / Networking | 15 |
| Skills / Evidence Growth | 15 |

CareerOS distinguishes between:

**No Activity** — an actionable opportunity existed, but no action occurred.

**Not Applicable** — the signal did not genuinely apply and is excluded from scoring.

Weekly reviews can be finalized into immutable historical snapshots. Later activity does not rewrite finalized weeks.

### AI Memory and Knowledge Graph

Route: `/workspace/memory`

CareerOS keeps structured long-term career memory, including facts, preferences, goals, skill signals, evidence signals, behavioral patterns, career patterns, constraints, milestones, and career focus.

Every system-derived memory requires provenance. CareerOS tracks source, evidence, confidence, first and last observation, temporal validity, contradictions, user corrections, suppression, and expiration.

Users can confirm, correct, mark outdated, stop a memory from being used, delete individual memories, delete all long-term memory, or rebuild memory from recent CareerOS history.

Memory never replaces the underlying domain source of truth.

The knowledge graph connects relevant career concepts through explainable relationships:

```text
User
 ├── TARGETS_ROLE ───────────→ Backend Engineer
 ├── HAS_SKILL ──────────────→ Go
 ├── HAS_EVIDENCE_FOR ───────→ PostgreSQL
 ├── LACKS_EVIDENCE_FOR ─────→ System Design
 └── PREFERS_WORK_STYLE ─────→ Remote
```

The graph is intentionally bounded. It is designed to improve contextual reasoning without becoming a large generic ontology.

---

## AI philosophy

CareerOS separates deterministic system truth from AI assistance.

AI can help with drafting, wording, summarization, explanation, and evidence summarization.

AI does not control:

- application status
- opportunity eligibility
- core prioritization
- Career Momentum scores
- memory confidence
- contradiction resolution
- deletion decisions
- provider capability state

Core workflows are designed to keep working when AI is unavailable.

---

## Privacy and security

CareerOS uses explicit ownership and privacy boundaries:

- authenticated user ownership
- cross-user isolation
- server-derived identity
- provider-token protection
- OAuth state validation
- structured memory provenance
- bounded AI context
- sensitive-data sanitization
- secure user-data export
- no client-controlled scoring or confidence
- no automatic reuse of deleted career memory

CareerOS is designed not to place passwords, OAuth tokens, API keys, encryption keys, or authentication internals into AI prompts or exported user data.

---

## Data export

CareerOS includes a structured JSON export for user-owned data. The export can include:

- profile and preferences
- resume metadata and revisions
- jobs and discovery data
- application history
- communication metadata
- LinkedIn publishing metadata
- daily roadmaps
- meaningful career activity
- weekly reviews
- career memory
- knowledge graph data
- relevant settings

Export queries are paginated internally, so completeness does not depend on UI list limits.

Authentication secrets and provider credentials are excluded.

---

## Settings

Route: `/workspace/settings`

Settings provide grouped access to:

- Career Planning
- Integrations
- Memory & Privacy
- AI / Provider Status
- Data & Export
- Account

Domain-specific modules remain the source of truth for their own settings.

---

## Technology stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- React Server Components
- responsive custom workspace UI
- Tailwind CSS
- Framer Motion, Three.js, React Three Fiber, and Drei where the interface needs them

### Backend

- Next.js App Router server routes
- server-side domain services
- Prisma ORM
- PostgreSQL
- Better Auth

### AI

- OpenAI integration
- deterministic fallback paths
- optional model and timeout configuration for selected analytics workflows

### Testing and validation

- Playwright headed browser testing
- milestone-specific QA scripts
- security regression tests
- Prisma validation
- production build verification

---

## Architecture

CareerOS is a **modular monolith**: one Next.js application with domain-specific services and controlled integration points. There are no microservices in this release.

```text
┌────────────────────────────────────────────────┐
│                  Workspace UI                  │
├────────────────────────────────────────────────┤
│ Jobs │ Resume │ Applications │ LinkedIn │ ... │
├────────────────────────────────────────────────┤
│                Domain Services                 │
├────────────────────────────────────────────────┤
│ Today │ Weekly Review │ Career Memory          │
├────────────────────────────────────────────────┤
│              Prisma + PostgreSQL               │
├────────────────────────────────────────────────┤
│ AI + Optional External Provider Integrations   │
└────────────────────────────────────────────────┘
```

AI is kept outside the core source-of-truth layer.

---

## Getting started

### Requirements

- Node.js **20.19+ (20.x)**, **22.12+ (22.x)**, or **24+** (Prisma 7)
- npm
- PostgreSQL
- Git

### Clone the repository

```bash
git clone https://github.com/omarm5238/CareerOS.git
cd CareerOS
```

### Install dependencies

```bash
npm install
```

For a lockfile-exact install, use `npm ci` instead.

### Environment setup

Copy the example environment file:

```bash
cp .env.example .env
```

Then fill in the services you want to use. `.env.example` is the source of truth. The current variables are:

```env
# Optional CareerOS Brief model and timeout overrides.
OPENAI_ANALYTICS_MODEL="gpt-4.1-mini"
OPENAI_ANALYTICS_FAST_MODEL="gpt-4.1-mini"
OPENAI_ANALYTICS_TIMEOUT_MS="30000"
OPENAI_ANALYTICS_RETRY_TIMEOUT_MS="18000"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/careeros"

# Auth
BETTER_AUTH_SECRET=""
BETTER_AUTH_URL="http://localhost:3000"

# OpenAI (optional — rule-based fallbacks apply when unset)
OPENAI_API_KEY=""
OPENAI_MODEL=""

# Job Discovery providers (optional)
ADZUNA_APP_ID=
ADZUNA_APP_KEY=

JOOBLE_API_KEY_US=
JOOBLE_API_KEY_UK=
JOOBLE_API_KEY_DE=
JOOBLE_API_KEY_TR=
```

Generate an authentication secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Never commit a real `.env` file or credentials.

### Database setup

```bash
npx prisma validate
npx prisma migrate deploy
npx prisma generate
```

On a local development database you can also use `npx prisma migrate dev`. The current Phase 2 schema includes **20 Prisma migrations**.

### Run the development server

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Assisted application execution and headed QA need Playwright Chromium available locally (`npx playwright install chromium`).

### Production build

```bash
npm run build
```

---

## Testing

Final Phase 2 hardening checks:

```bash
npm run m29:qa
npm run m29:security
npm run m29:headed
```

Additional validation:

```bash
npx prisma validate
npx prisma migrate status
npm run build
git diff --check
```

Earlier milestone-specific QA scripts are also retained in the repository.

---

## Project status

### Phase 2 — Complete

The current public release represents the completion of CareerOS Phase 2.

| Milestone | Status |
|---|---|
| M21 — Job-Specific Resume Versions | Complete |
| M22 — Application Tracker v2 | Complete |
| M23 — Job Discovery & Application Queue | Complete |
| M24 — Communication & Content Generation | Complete |
| M24.5A — Opportunity Intelligence + Apply Now | Complete |
| M24.5B — External Application Execution | Complete |
| M24.5C — Live Provider Submit Validation | Complete |
| M25A — LinkedIn Growth System | Complete |
| M25B — Official LinkedIn Connection + Verified Publishing | Complete |
| M26 — Daily Roadmap + Career Streak | Complete |
| M27 — Weekly Review + Career Momentum | Complete |
| M28 — AI Memory + Knowledge Graph | Complete |
| M29 — Personal Experience Hardening | Complete |

---

## Current release

### `v0.29-personal-experience-hardening`

This release completed the Phase 2 hardening pass. It includes:

- visual consistency improvements
- responsive cleanup
- accessibility basics
- bounded query behavior
- long-term dataset validation
- centralized settings
- complete paginated user-data export
- security hardening
- final Phase 2 end-to-end validation

---

## Known limitations

CareerOS currently prioritizes a strong personal workflow over broad platform support.

- Some external application providers remain gated until live submission is validated.
- Official LinkedIn publishing requires valid provider configuration and authorization.
- LinkedIn analytics depend on available official capabilities.
- CareerOS is currently optimized for personal use rather than organizational multi-user workflows.
- JSON is currently the primary complete user-data export format.
- Accessibility has received a practical baseline pass, not a formal WCAG certification.
- The knowledge graph UI prioritizes explainable relationships rather than complex force-directed visualization.
- Some external integrations may require a manual fallback depending on provider capability.

These limitations are intentionally exposed rather than hidden behind simulated success.

---

## Design language

CareerOS uses a dark **Black Titanium / Graphite Executive** visual system.

The interface is designed to feel focused, technical, and restrained: information-dense without becoming cluttered, consistent across career workflows, and usable on desktop and mobile.

CareerOS intentionally avoids heavy gamification and dashboard overload.

---

## Repository safety

Never commit:

```text
.env
.env.local
API keys
OAuth credentials
provider tokens
database credentials
production exports
private user data
```

Before running CareerOS outside local development, review `.env.example` and configure only the integrations you intend to use.

---

## Roadmap

Phase 2 is complete.

Future work can build on this stable baseline without reopening the core Phase 2 architecture. Possible later directions include deployment hardening, additional provider integrations, broader automation, richer analytics, collaboration or multi-user capabilities, and expanded export/import workflows.

Those items are intentionally outside the current Phase 2 scope.

---

## License

A public repository license has not yet been finalized.

---

## Author

**Omar Mohamed Hassan**

Software Engineer

CareerOS is a personal project exploring how structured software systems, deterministic decision logic, and AI assistance can work together in a real career-management workflow.
