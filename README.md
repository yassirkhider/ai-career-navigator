# AI Career Navigator

An AI-powered career agent: build a Master Career Profile from your CV,
analyze job fit against real requirements with evidence-based reasoning,
track skill gaps, get targeted CVs and cover letters, practice interviews,
and track applications — all in one place.

Product name, branding, and colors are centralized in `src/lib/branding.ts`
for easy rebranding.

## What's implemented

Auth (register/login/logout/sessions), onboarding-adjacent Master Career
Profile, CV upload + AI parsing (PDF/DOCX/TXT), job posting input + AI
parsing, AI Job Fit Engine (weighted scoring, per-requirement match/gap
classification), Gap Classification + prioritized Action Plan, Skill ROI
Engine (cross-job demand frequency, recommended learning order), Learning
Recommendation Engine (course suggestions with an explicit
no-fabricated-URLs policy), AI CV Builder + version control (with real
DOCX export), ATS Analysis
(estimated, clearly labeled as such), Cover Letter Generator (4 tones),
Similar/Adjacent Job Discovery, Job Application Tracker (Kanban + table),
AI Interview Coach (question generation + 6-dimension answer scoring),
Career Path Prediction, Master Skills Passport, LinkedIn Optimizer,
Career Dashboard, and an Admin Panel (user management, system stats,
audit log).

## Known gaps (not implemented in this pass)

- **Job Discovery Engine**: no live external job-board API is wired in —
  this needs real credentials for a licensed job feed/API, which weren't
  available while building this. The architecture (pluggable provider
  pattern, as used for `CourseProvider` in the Learning Engine) generalizes
  to this; it just isn't built yet.
- **PDF export**: CV versions and cover letters export as plain text or
  real DOCX (Word) documents — verified as genuinely valid OOXML, not just
  text with a renamed extension. PDF export specifically is not yet
  implemented.
- **Notifications**: no in-app or email notification system yet.
- **Real-time course catalog verification**: see
  `docs/AI_ARCHITECTURE.md` — course suggestions are AI-generated from
  general knowledge, explicitly not fabricating specific course URLs, but
  not checked against a live catalog API either.
- **Full E2E test suite**: only a starting unit-test suite exists (16
  tests). See `docs/TESTING.md`.
- **OAuth (Google/Microsoft/LinkedIn)**: the auth layer is structured to
  make this addable later but it isn't implemented.

## Tech stack

Next.js 16 (App Router) + TypeScript, Tailwind CSS, PostgreSQL via
Drizzle ORM, hand-rolled session auth (bcrypt + JWT), Zod validation,
Anthropic API via a vendor-agnostic provider abstraction. See
`docs/ARCHITECTURE.md` for the two deliberate substitutions made from the
originally-requested stack (Drizzle instead of Prisma; hand-rolled auth
instead of NextAuth) and why.

## Local development

```bash
cp .env.example .env
# edit .env: set a real AUTH_SECRET (openssl rand -hex 32) and,
# optionally, ANTHROPIC_API_KEY (without it, AI features use a clearly
# labeled non-AI dev placeholder — see docs/AI_ARCHITECTURE.md)

npm install
npx drizzle-kit migrate   # requires DATABASE_URL pointing at a running Postgres
npm run dev
```

Open http://localhost:3000.

## Testing

```bash
npm test          # vitest unit tests
npm run lint       # eslint
npx tsc --noEmit   # type check
npm run build      # production build
```

## Docker

```bash
cp .env.example .env
docker compose --profile migrate run --rm migrate
docker compose up -d db app
```

See `docs/DEPLOYMENT.md` for details and an important note on Docker
verification status.

## Documentation

- `docs/ARCHITECTURE.md` — stack, module map, substitution rationale
- `docs/DATABASE.md` — schema, migrations, backup guidance
- `docs/AI_ARCHITECTURE.md` — provider abstraction, prompts, anti-hallucination design
- `docs/SECURITY.md` — auth, IDOR protection, what's not yet covered
- `docs/DEPLOYMENT.md` — Vercel and Docker deployment steps
- `docs/TESTING.md` — automated + manual verification performed
- `docs/API.md` — every route, generated from the actual route files
