# Deployment

Two supported paths — Vercel + managed Postgres, or Docker anywhere.

## Option A: Vercel + managed Postgres

1. Provision a managed Postgres instance (Vercel Postgres, Neon, Supabase,
   RDS, etc.) and get its connection string
2. Set environment variables in the Vercel project (see `.env.example` for
   the full list): `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`,
   `APP_URL`
3. Run migrations against the production database before or during deploy:
   `DATABASE_URL=<prod-url> npx drizzle-kit migrate`
   (run this from CI or locally against the prod DB — do not rely on
    `drizzle-kit push` in production)
4. Deploy — Vercel auto-detects the Next.js build (`npm run build`)
5. **File storage note**: `LocalFileStorage` writes to the local
   filesystem, which does not persist across Vercel's serverless
   invocations. Before deploying to Vercel, implement an S3-compatible
   `StorageProvider` (interface in `src/lib/storage/index.ts`) — this is a
   known gap, not yet built in this pass.

## Option B: Docker on a VPS (full walkthrough)

### 1. Provision a server

Any VPS with a public IP works (DigitalOcean, Hetzner, Linode, AWS
Lightsail, etc.) — 2GB RAM minimum. Ubuntu 22.04/24.04 LTS assumed below.

### 2. Point DNS at it first

Create an A record for your domain (e.g. `app.yourdomain.com`) pointing
at the server's IP, **before** starting Caddy — it needs to be resolvable
to obtain a TLS certificate from Let's Encrypt.

### 3. Install Docker

```bash
ssh root@your-server-ip

curl -fsSL https://get.docker.com | sh
# (Docker Compose v2 is included as `docker compose` with the script above)
```

### 4. Get the code onto the server

```bash
# Recommended: via git, so future updates are `git pull` + rebuild.
apt-get install -y git
git clone <your-repo-url> ai-career-navigator
cd ai-career-navigator
```

### 5. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in for real:
- `AUTH_SECRET` — `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — a strong random value (not in `.env.example` by
  default; add it yourself)
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `DOMAIN` — the domain you pointed at this server, e.g. `app.yourdomain.com`
- `APP_URL` — `https://` + the same domain, e.g. `https://app.yourdomain.com`
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` — from
  your Stripe Dashboard (see `docs/BILLING.md`); leave blank to run
  without billing enforcement working yet

### 6. Apply migrations, then start everything

```bash
docker compose --profile migrate run --rm migrate
docker compose up -d --build db app caddy
```

Caddy automatically requests and renews a Let's Encrypt certificate for
`DOMAIN` on first request — no manual certbot step. `docker compose logs -f caddy`
to watch it happen; it typically takes a few seconds.

### 7. Verify

```bash
docker compose ps                 # all three services should show "Up" / "healthy"
curl -I https://app.yourdomain.com   # should return 200/307, with a valid cert
```

Visit `https://app.yourdomain.com` in a browser, register an account, and
confirm the dashboard loads.

### 8. Point Stripe's webhook at the real domain

In the Stripe Dashboard, create (or update) the webhook endpoint to
`https://app.yourdomain.com/api/billing/webhook`, copy its signing
secret into `STRIPE_WEBHOOK_SECRET` in `.env`, then:

```bash
docker compose up -d --build app   # picks up the new env var
```

### Updating later

```bash
git pull
docker compose --profile migrate run --rm migrate   # only if schema.ts changed
docker compose up -d --build app
```

### Architecture notes

The `Dockerfile` is a 3-stage build (`deps` → `builder` → `runner`) using
Next's `output: "standalone"`, which traces and copies only the exact
`node_modules` the server actually needs into the final image — the
runtime image does not carry the full dev dependency tree.

Migrations run as a **separate** one-off `migrate` service (using the
full `builder` stage, which has complete `node_modules` including
`drizzle-kit` and its transitive dependencies) rather than being baked
into the slim runtime image — hand-copying a dev CLI tool's dependencies
into a trimmed image is fragile and was deliberately avoided here.

Neither Postgres nor the Next.js app container expose a port to the host
directly — only Caddy (ports 80/443) is reachable from the internet, and
it reverse-proxies to `app:3000` over the internal Docker network. This
means TLS termination, HSTS, and basic security headers (see the
`Caddyfile`) are handled at the proxy layer, in front of the application.

> **Note on verification**: this Dockerfile/compose setup was authored
> and reviewed against real build artifacts (`.next/standalone` contents
> were inspected directly to confirm what Next actually bundles), but
> Docker itself was not available in the sandbox this project was built
> in, so `docker build`/`docker compose up` have not been executed
> end-to-end by the assistant that wrote them. Run through steps 1-7
> above yourself and treat the first real deploy as the actual
> verification — report back anything that breaks.

## Required environment variables

See `.env.example` for the complete, authoritative list (generated by
grepping the codebase for every `process.env.*` reference, not written
from memory).

## Pre-deploy checklist

- [ ] `AUTH_SECRET` is a real random 32+ character value (not the example placeholder)
- [ ] `ANTHROPIC_API_KEY` is set (the app refuses to start the AI mock fallback when `NODE_ENV=production`)
- [ ] Migrations applied against the production database
- [ ] If deploying billing on top of an **existing** user base, run
      `DATABASE_URL=<prod-url> npx tsx scripts/backfill-subscriptions.ts`
      immediately after migrating — otherwise every existing user is
      instantly locked out (no subscription row = locked, by design; see
      `docs/BILLING.md`)
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] File storage is not `LocalFileStorage` if deploying to a
      multi-instance or serverless target
