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

RUN pnpm run build && pnpm run db:compile

# ---------------------------------------------------------------
# 4️⃣ Production runtime
# ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# ---------------------------------------------------------------
# Install tini for proper signal handling
# ---------------------------------------------------------------
RUN apt-get update && apt-get install -y \
    tini \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------
# Copy package manager files
# ---------------------------------------------------------------
COPY package.json pnpm-lock.yaml ./

# ---------------------------------------------------------------
# Install ONLY production dependencies
# ---------------------------------------------------------------
RUN pnpm install --prod --frozen-lockfile

# ---------------------------------------------------------------
# Copy compiled application
# ---------------------------------------------------------------
COPY --from=builder /app/dist ./dist

# ---------------------------------------------------------------
# Copy startup scripts
# ---------------------------------------------------------------
COPY --from=builder /app/scripts ./scripts

# ---------------------------------------------------------------
# Ensure scripts are executable
# ---------------------------------------------------------------
RUN chmod +x /app/scripts/docker-entrypoint.sh

# ---------------------------------------------------------------
# Ensure correct ownership
# ---------------------------------------------------------------
RUN chown -R node:node /app

# ---------------------------------------------------------------
# Switch to non-root user
# ---------------------------------------------------------------
USER node

# ---------------------------------------------------------------
# Expose application port
# ---------------------------------------------------------------
EXPOSE 3200

# ---------------------------------------------------------------
# Health check
# ---------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3200/api/health/live').then(() => process.exit(0)).catch(() => process.exit(1))"

# ---------------------------------------------------------------
# Application startup
# ---------------------------------------------------------------
ENTRYPOINT ["/usr/bin/tini", "--", "sh", "/app/scripts/docker-entrypoint.sh"]

CMD ["node", "dist/main.js"]