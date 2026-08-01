# syntax=docker/dockerfile:1
# App images use Debian slim (glibc). Runtime ships pnpm (corepack) for ops
# scripts; deps are still preinstalled — no install at container start.
# Floor is roughly node:22-bookworm-slim (~200MB) + stripped prod node_modules (~65MB).

# ---------------------------------------------------------------
# 1️⃣ Base (build stages only)
# ---------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PNPM_STORE_DIR="/pnpm/store"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable \
  && corepack prepare pnpm@9.15.9 --activate \
  && pnpm --version \
  && pnpm --version | grep -E '^9\.'

WORKDIR /app

# ---------------------------------------------------------------
# 2️⃣ Full dependencies (build)
# ---------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------
# 3️⃣ Builder
# ---------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN pnpm run build

# ---------------------------------------------------------------
# 4️⃣ Production dependencies only (+ strip junk)
# TypeORM's optional ts-node peer pulls typescript/@types into --prod installs;
# remove those plus docs/maps/sources that are unused at runtime.
# ---------------------------------------------------------------
FROM base AS prod-deps

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile \
 && rm -rf \
      node_modules/.pnpm/typescript@* \
      node_modules/.pnpm/ts-node@* \
      node_modules/.pnpm/@types+* \
      node_modules/typescript \
      node_modules/ts-node \
      node_modules/@types \
 && find node_modules -type f \( \
      -name "*.md" -o -name "*.markdown" -o -name "*.map" -o \
      -name "*.ts" -o -name "*.tsx" -o -name "*.d.ts" -o \
      -name "LICENSE*" -o -name "CHANGELOG*" -o -name "LICENSE" \
    \) -delete \
 && find node_modules -type d \( \
      -name "test" -o -name "tests" -o -name "__tests__" -o \
      -name "docs" -o -name "example" -o -name "examples" -o \
      -name ".github" \
    \) -prune -exec rm -rf {} + \
 && find node_modules -type d -empty -delete

# ---------------------------------------------------------------
# 5️⃣ Lean runtime
# ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/docker-entrypoint.sh /app/scripts/docker-migrate.sh ./scripts/

RUN chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/docker-migrate.sh \
  && chown -R node:node /app

USER node

EXPOSE 3200

ENTRYPOINT ["/usr/bin/tini", "--", "sh", "/app/scripts/docker-entrypoint.sh"]

CMD ["node", "dist/main.js"]
