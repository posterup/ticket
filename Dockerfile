# syntax=docker/dockerfile:1

# Poster (پوستر) — Next.js 15 + Prisma 7 on Postgres.
#
# Three stages matter to the compose stack:
#   * `migrator` — carries the Prisma CLI, schema and migrations. Runs
#     `prisma migrate deploy` once per stack start, then exits.
#   * `runner`   — the app. Next's standalone output, no node_modules, non-root.
#
# The Prisma client is generated with the `prisma-client` generator against a
# driver adapter (`@prisma/adapter-pg`), so the query path is plain JS with no
# native engine to install. Only the CLI in `migrator` needs an engine binary.

ARG NODE_VERSION=24-alpine

# ───────────────────────────── dependencies ─────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# `postinstall` runs `prisma generate`, so the schema has to be present before
# install. `prisma.config.ts` reads DATABASE_URL with `??` and generate needs no
# database, so this works with no connection string.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci

# ───────────────────────────── build ─────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Switches next.config.ts to standalone output.
ENV DOCKER_BUILD=1

# `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
# this feature flag has to arrive here as a build argument. Setting it as a
# runtime environment variable would have no effect on the browser.
ARG NEXT_PUBLIC_CALENDAR_MODE=
ENV NEXT_PUBLIC_CALENDAR_MODE=${NEXT_PUBLIC_CALENDAR_MODE}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY . .

RUN npm run build

# ───────────────────────────── migrator ─────────────────────────────
# Kept separate so the Prisma CLI and its engine binaries never ship in the
# image that faces traffic.
FROM node:${NODE_VERSION} AS migrator
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
# `prisma/seed.ts` reaches into the enum mappers and the shared domain types,
# so the seed command needs these two directories as well. Migrations alone do
# not, but they are small and keep one image serving both jobs.
COPY lib ./lib
COPY types ./types

CMD ["npx", "prisma", "migrate", "deploy"]

# ───────────────────────────── runtime ─────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as the unprivileged `node` user that the base image already provides.
USER node

# `standalone` already contains the traced subset of node_modules — including
# the generated Prisma client, which is reached through the `@/generated`
# alias and so is picked up by Next's dependency tracing. Static assets are
# not traced and are copied separately. There is no `public/` directory in
# this project, so none is copied.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

EXPOSE 3000

# busybox wget — the runtime image deliberately has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:3000/api/auth/me || exit 1

CMD ["node", "server.js"]
