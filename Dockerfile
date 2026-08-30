# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL/AUTH_SECRET are required for module evaluation at build time
# by some server-side modules, but `next build` does not connect to the DB
# (all routes here are dynamic, not statically generated against data) —
# placeholders keep the build hermetic and reproducible in CI.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV AUTH_SECRET="placeholder-build-time-secret-not-used-at-runtime-32ch"
RUN npm run build

# ---- runtime ----
# Next's `output: "standalone"` build already traces and copies the exact
# node_modules subset the server needs (see next.config.ts) — do not
# manually copy additional packages into this stage, since a hand-picked
# subset of a package's transitive dependencies (e.g. drizzle-kit, which
# has many) will silently omit files and break at runtime. Migrations run
# as a separate step against the `builder` stage instead — see
# docker-compose.yml's `migrate` service and docs/DEPLOYMENT.md.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
