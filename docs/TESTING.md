# Testing

## Automated tests

```bash
npm test          # runs vitest once
```

Current coverage (`src/**/*.test.ts`, 16 tests across 3 files, all passing
as of this writing):
- `src/lib/auth/password.test.ts` — strength validation rules, real bcrypt
  hash/verify round-trips, salting behavior
- `src/lib/auth/jwt.test.ts` — sign/verify round-trip, tampered-token
  rejection, expired-token rejection, garbage-input rejection
- `src/lib/rate-limit.test.ts` — allow/block at threshold, window reset
  (using fake timers), independent tracking per key

This is a starting unit-test suite for pure, DB-independent security logic
— it is **not** a full test pyramid. Not yet covered by automated tests:
integration tests against a real database, API route tests, component
tests, and end-to-end browser tests (Playwright). These are the natural
next additions.

## Manual end-to-end verification performed during development

Every feature in this project was manually verified against a real,
running Postgres database and a real running Next.js server (not just
code review) before being considered complete, including:
- Full auth flow: register, login, /me, logout, session revocation
  confirmed via DB row count
- Cross-user IDOR attempts on every resource type, confirmed blocked
- File upload validation (rejected `.exe`, accepted `.txt`/`.pdf`/`.docx`)
- A CV containing an embedded prompt-injection attempt, confirmed
  processed as inert text
- Full regression sweep (every route hit with `curl` and an authenticated
  session) after each new feature addition, to catch cross-feature
  breakage
- Production build (`npm run build`) run and confirmed passing after
  every feature addition, not just at the end

## Suggested next steps for a fuller suite

- **Integration tests**: spin up a real (or testcontainers) Postgres,
  exercise API routes directly, assert on DB state — the manual `curl`
  scripts run during development are a good starting point to convert
  into `it()` blocks
- **Component tests**: React Testing Library for the more complex client
  components (`CvBuilder`, `ApplicationTracker`, `InterviewPractice`)
- **E2E**: Playwright covering the mandatory flow listed in the original
  spec (register, CV upload, job analysis, gap view, CV generation,
  application tracking, logout)
