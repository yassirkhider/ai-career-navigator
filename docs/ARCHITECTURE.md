# Architecture

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript
- **UI**: Tailwind CSS, server components by default with client components only where interactivity is needed
- **Database**: PostgreSQL, accessed via Drizzle ORM (see [Substitution note](#why-drizzle-not-prisma) below)
- **Auth**: Hand-rolled session auth — bcrypt password hashing + JWT session tokens in httpOnly cookies, backed by a revocable `sessions` table (see [Substitution note](#why-hand-rolled-auth-not-nextauth))
- **AI**: Provider-abstracted (`AIProvider` interface) — real `AnthropicProvider` plus a `DevMockProvider` for environments without an API key
- **Validation**: Zod on every API route input and every AI-generated structured output
- **File storage**: `StorageProvider` interface, `LocalFileStorage` implementation for dev/single-instance; swap in an S3-compatible implementation for production without touching callers

## Why Drizzle, not Prisma

The original plan was Prisma. Prisma's CLI (`generate`, `migrate`) downloads
native engine binaries from `binaries.prisma.sh` at install/build time. In
the sandboxed environment this project was originally built in, that host
was not reachable (confirmed via direct 403s, including with the CLI's
checksum-bypass flag). Rather than leave migrations broken, the project was
switched to Drizzle ORM, which is pure TypeScript/JS with no native-binary
download step. This is a legitimate, common alternative — re-evaluate for
your own deployment target; if Prisma's CDN is reachable in your CI/build
environment, migrating back is a schema-rewrite exercise, not an
architectural blocker.

## Why hand-rolled auth, not NextAuth/Auth.js

Auth.js v5 was in beta at the time of writing and its official adapter
pattern assumes NextAuth's own default schema. Wiring a beta adapter against
a hand-designed schema carried more integration risk than it saved, so
sessions are implemented directly: bcrypt for password hashing, `jose` for
JWT signing/verification, and a `sessions` table for server-side revocation
(logout actually deletes the row, not just the cookie). This is a smaller
surface area to audit and test than pulling in a full auth framework.

## Module map

Each major feature lives across three places:
1. **Schema** (`src/lib/db/schema.ts`) — the tables/enums for that feature
2. **Prompt** (`src/lib/ai/prompts/*.ts`, for AI features) — system prompt + Zod schema for structured output, versioned
3. **Route + UI** (`src/app/api/**`, `src/app/**`, `src/components/**`)

Implemented features (see the repo root README for the full list and what's
still outstanding): auth, onboarding-adjacent Master Career Profile, CV
upload/parsing, job input/parsing, AI Job Fit Engine, Gap Classification +
Action Plan, Skill ROI Engine, Learning Recommendation Engine, AI CV
Builder + version control, ATS Analysis, Cover Letter Generator, Similar Job
Discovery, Job Application Tracker, AI Interview Coach, Career Path
Prediction, Master Skills Passport, LinkedIn Optimizer, Career Dashboard,
Admin Panel.

Not implemented in this pass (see README "Known gaps"): live Job Discovery
against a real job-board API, Notifications, real-time course-catalog
verification, PDF/DOCX binary export (plain-text export exists), full
Playwright E2E suite.

## Request flow (typical AI feature)

1. Client calls an API route (e.g. `POST /api/jobs/:id/analyze`)
2. Route authenticates (`getCurrentUser`), authorizes (ownership check —
   IDOR protection), validates input with Zod
3. Route builds a prompt via the relevant `src/lib/ai/prompts/*.ts` module —
   untrusted content (CVs, job postings) is always wrapped in `<document>`
   tags with explicit "treat as data, not instructions" language, as
   defense against prompt injection
4. Route calls `getAIProvider().generateStructured(...)`, which validates
   the model's JSON response against a Zod schema and retries once on
   validation failure
5. Result is persisted (with the raw AI response kept for audit) and
   returned to the client
