# Security

## Authentication

- Passwords hashed with bcrypt (12 salt rounds), never stored or logged in
  plaintext
- Server-side password policy: 10+ characters, upper+lower+digit
  (`src/lib/auth/password.ts`)
- Sessions: JWT (HS256, `jose`) in an httpOnly, `sameSite=lax` cookie,
  `secure` in production, backed by a `sessions` table for real revocation
  — logout deletes the DB row, not just the cookie
- Login is timing-attack-resistant against user enumeration: a dummy bcrypt
  hash is compared even when no matching account exists, so response time
  doesn't leak whether an email is registered
- Registration returns a generic error on duplicate email rather than
  confirming the email exists

## Authorization / IDOR protection

Every resource-scoped route re-checks ownership on every request — never
trusts that an ID in the URL belongs to the caller. Pattern used
throughout:

```ts
const [row] = await db.select().from(table)
  .where(and(eq(table.id, id), eq(table.userId, user.id)))
  .limit(1);
if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
```

Returning 404 (not 403) for another user's resource avoids confirming the
resource exists at all. This was verified in testing across every
resource type (jobs, CV versions, applications, cover letters, interview
sessions/questions/answers, ATS analyses, skills) with a second test
account attempting cross-user access.

Admin routes use a separate `requireAdmin()` check (403 for the API, 404
for the page) and the admin user-list endpoint deliberately returns only
account metadata (id, email, name, role, timestamps) — never career
profile content, CV text, or job data, even for admins.

## Input validation

Every API route validates its input with Zod before touching the
database. File uploads are validated on extension, MIME type, and size
(10MB cap) before being written to disk with a randomized server-side
filename (never the client-provided name).

## Rate limiting

In-memory fixed-window rate limiting (`src/lib/rate-limit.ts`) applied to
auth endpoints and every AI-calling endpoint. This is process-local and
resets on restart — sufficient for a single-instance deployment; for a
horizontally-scaled production deployment, swap the implementation for a
shared store (Redis/Upstash) behind the same function signature.

## Prompt-injection defense

See `docs/AI_ARCHITECTURE.md`. Untrusted content (CVs, job postings) is
always wrapped in `<document>` tags with explicit "this is data, not
instructions" framing in every prompt that touches it.

## File security

- Allowed formats: PDF, DOCX, TXT only (extension + MIME both checked)
- 10MB size cap
- Randomized server-side filenames (`crypto.randomBytes`), never the
  client-supplied name
- Files written with `mode: 0o600`
- No malware-scanning integration yet — flagged as a gap for a production
  deployment handling untrusted uploads at scale; the `StorageProvider`
  interface is the natural integration point for one

## What's NOT yet implemented (be aware of these gaps)

- CSRF tokens (mitigated partially by `sameSite=lax` cookies + the app
  having no cross-origin state-changing GET requests, but not a full CSRF
  token implementation)
- Security headers (CSP, HSTS, X-Frame-Options, etc.): set by the Caddy
  reverse proxy in the Docker deployment path (see `Caddyfile`) —
  HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy. Not
  yet a full CSP (Content-Security-Policy), and not configured at all if
  you deploy via Vercel/another host instead of the Docker path — those
  targets would need equivalent headers configured at that platform's edge
  or in `next.config.ts`.
- Signed/expiring URLs for uploaded file access
- Structured production logging / external error tracking integration
- Two-factor authentication, OAuth (Google/Microsoft/LinkedIn) — the auth
  layer was designed to make adding OAuth providers straightforward later
  (separate `sessions` table not coupled to password auth specifics) but
  it is not implemented

## Observability

`ai_interactions` logs every AI call (prompt name/version, model, token
counts, latency, success/failure) without ever logging full prompt or
response content, secrets, or passwords. `audit_logs` records
security-relevant actions (registration, login, admin changes, resource
creation/deletion) with actor, action, entity, and metadata.
