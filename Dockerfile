# ---------------------------------------------------------------
# 1️⃣ Base image
# ---------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# ---------------------------------------------------------------
# 2️⃣ Dependencies stage
# ---------------------------------------------------------------
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------
# 3️⃣ Builder stage
# ---------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# ---------------------------------------------------------------
# 4️⃣ Production runtime
# ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts

RUN chmod +x /app/scripts/docker-entrypoint.sh

USER node

EXPOSE 3200

ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]

CMD ["node", "dist/main.js"]