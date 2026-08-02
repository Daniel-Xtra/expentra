# Expentra VPS Deploy Guide

Hands-on curriculum for deploying Expentra on a single Nobus VPS with **staging** and **production** side by side. You run the commands on the server; this doc is the map.

**Stack per environment:** API (`dist/main.js`) + worker (`dist/worker.js`) + Postgres 15 + Redis 7  
**Local references:** [`docker-compose.yml`](../docker-compose.yml), [`Dockerfile`](../Dockerfile), [`.env.example`](../.env.example)

---

## Target layout

| Piece | Staging | Production |
|-------|---------|------------|
| Directory | `/opt/expentra-staging` | `/opt/expentra-production` |
| Git branch | `staging` | `main` |
| Compose project name | `expentra-staging` | `expentra-production` |
| API port (early / localhost) | `3201` | `3200` |
| Env file | `.env` (staging secrets) | `.env` (prod secrets) |
| Postgres + Redis | own containers + volumes | own containers + volumes |
| JWT / DB passwords | different from prod | different from staging |
| Image tag (Phase 9+) | `youruser/expentra:staging` | `youruser/expentra:production` |

Shared on the host: Docker Engine, UFW, later one Caddy process routing by hostname.

**Deploy evolution**

1. Phases 5–8 — build images on the VPS with `docker compose up --build`
2. Phase 9a — push/pull via Docker Hub by hand
3. Phase 9b — GitHub Actions builds → Hub → VPS pulls

**RAM:** plan for roughly 2–4 GB minimum for both stacks (8 app-related containers + OS).

---

## Phase 0 — Mental model

**Why:** understand what “production on a VPS” means before typing commands.

- One Linux box; Docker runs the containers.
- Secrets live only in root-owned `.env` files on the server — **never commit them**.
- Postgres and Redis stay on a private Docker network — **never published to the internet**.
- Staging and production never share Compose `name`, volumes, or secrets.
- Caveat: both envs on one machine means a staging compromise can threaten prod. Fine for learning/early product; split VPSes later if needed.

**Checkpoint:** you can explain why we use two Compose projects instead of one shared database.

---

## Phase 1 — VPS access and hardening

**Why:** a raw VPS with password root login gets scanned and attacked within minutes.

1. Confirm OS (Ubuntu 22.04 or 24.04 preferred) and how you SSH (root vs another user).
2. Create a non-root sudo user; copy your SSH public key.
3. After key login works for that user, disable password authentication (and optionally root SSH).
4. Enable UFW: allow `22/tcp`; later `80`/`443`. Do **not** allow `5432` or `6379`. Prefer SSH tunnels over opening API ports publicly.
5. Optional: install `fail2ban` for SSH.

**Commands to gather (paste outputs to your tutor):**

```bash
cat /etc/os-release
free -h
whoami
```

**Checkpoint:** you can SSH with a key as the non-root user; password login from the internet fails.

---

## Phase 2 — Install Docker + size check

**Why:** Compose is how we run API, worker, Postgres, and Redis as one unit per environment.

1. Install Docker Engine + the Compose plugin (official Docker docs for Ubuntu).
2. Add your deploy user to the `docker` group (then log out/in).
3. Check disk and RAM again: `free -h`, `df -h`.

**Checkpoint:**

```bash
docker compose version
docker run --rm hello-world
```

---

## Phase 3 — Two code checkouts

**Why:** two clones let you deploy staging without disturbing a production checkout mid-`git pull`.

```text
/opt/expentra-staging      → git clone … && git checkout staging
/opt/expentra-production   → git clone … && git checkout main
```

Private repo: use a deploy key or personal access token.

**Checkpoint:** each directory contains `Dockerfile` and `docker-compose.yml` on the correct branch.

---

## Phase 4 — Separate env files

**Why:** identical secrets across envs mean a staging leak compromises production auth.

On each checkout, copy `.env.example` → `.env` and point Compose `env_file` at it.

**Must differ between staging and production**

- `JWT_SECRET` / `JWT_REFRESH_SECRET` (≥16 chars in production)
- `POSTGRES_PASSWORD` (and preferably `POSTGRES_DB`, e.g. `expentra_staging` vs `expentra`)
- `SEED_SUPER_ADMIN_PASSWORD`
- `APP_URL` / `ALLOWED_ORIGINS`
- Optional: Cloudinary folder split so uploads do not mix

**Both environments**

- May use `NODE_ENV=production` (Nest production behavior). “Staging” is an environment name, not “run Nest in development mode on the server.”
- Real `CLOUDINARY_*` values (required for app boot)
- API: `RUN_MIGRATIONS=true`; worker: `RUN_MIGRATIONS=false`
- Seed once with `RUN_SEED=true`, then turn seed off

Without a domain, temporary URLs look like `http://VPS_IP:3201` (staging) and `http://VPS_IP:3200` (prod), or your real frontend origins. Secure cookies need HTTPS — expect auth cookie quirks until Phase 7.

**Checkpoint:** neither `.env` still has `change-me`; secrets are not copy-pasted identical across envs.

---

## Phase 5 — Two hardened Compose stacks

**Why:** default local Compose publishes Postgres/Redis to the host; that is unsafe on a public VPS.

In-repo files:

| File | Use |
|------|-----|
| [`docker-compose.yml`](../docker-compose.yml) | Local only (`pnpm compose:up`) — builds `expentra:local` |
| [`compose.staging.yml`](../compose.staging.yml) | VPS + CI — pulls Hub image, loopback ports, `.env` |

Staging on the VPS:

```bash
cd /opt/expentra-staging
# Ensure .env exists (from Phase 4)
docker compose -f compose.staging.yml pull
docker compose -f compose.staging.yml up -d
```

Production later: same pattern with `compose.production.yml` (not yet added).

**Checkpoint:**

```bash
curl -s http://127.0.0.1:3201/api/health/live
curl -s http://127.0.0.1:3201/api/health/ready
docker compose -f compose.staging.yml ps
```

---

## Phase 6 — Reach from your laptop

**Why:** APIs stay on localhost; you tunnel in for testing without opening ports to the world.

```bash
ssh -L 3200:127.0.0.1:3200 -L 3201:127.0.0.1:3201 user@YOUR_VPS_IP
```

Then locally: staging `http://localhost:3201`, production `http://localhost:3200`.

**Checkpoint:** both health endpoints work through the tunnel; seeded admin works on each env.

---

## Phase 7 — Domain + HTTPS

**When:** you have a domain pointed at the VPS IP.

1. DNS `A` records, e.g. `api.yourdomain.com` and `staging-api.yourdomain.com` → VPS IP.
2. Install **Caddy** on the host; reverse-proxy each hostname to `127.0.0.1:3200` / `:3201`.
3. UFW: allow `80`/`443` only; keep API ports localhost-bound.
4. Set `TRUST_PROXY=true`, update `APP_URL` and `ALLOWED_ORIGINS` to `https://…`; recreate api/worker containers.

**Checkpoint:** HTTPS works in the browser; cookies and CORS use the real origins.

---

## Phase 8 — Ops hygiene (manual)

**Why:** CI will fail someday; you need a manual fallback and backups.

- Backups: separate `pg_dump` cron per Compose project (staging can be less frequent).
- Updates: `git pull` in the matching dir → `docker compose up -d --build`.
- Logs: from the project dir, `docker compose logs -f api worker`.
- Never share `.env` across envs; never expose DB/Redis ports.

**Checkpoint:** you can restore a dump into a throwaway container, and you know how to roll forward manually.

---

## Phase 9a — Docker Hub (by hand)

**Why:** build once, pull everywhere. The VPS should not be your primary build machine forever.

1. Create a Docker Hub account and an **Access Token** (do not use your account password in CI).
2. `docker login` on your machine (and on the VPS with a read-only token if the image is private).
3. Image names: `docker.io/<user>/expentra:<tag>`.
4. Build from the Dockerfile; tag `staging` / `production` / git SHA; `docker push`.
5. On the VPS: Compose uses `image: <user>/expentra:staging` (pull) instead of `build:` for api/worker.
6. Deploy: `docker compose pull && docker compose up -d`.

**Checkpoint:** you push a tag, pull it on the VPS, and staging restarts on the Hub image.

---

## Phase 9b — GitHub Actions CI/CD

**Why:** push to `staging` should deploy without hand-SSH every time.

Workflows in-repo:

| File | When | What |
|------|------|------|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | PR → `staging`/`main`/`develop`; push → `develop` | lint, build, unit tests |
| [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) | push → `staging` (or manual) | build → Hub → `git pull` → `docker compose -f compose.staging.yml pull/up` |

**GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `DOCKERHUB_USERNAME` | e.g. `danielakanbi` |
| `DOCKERHUB_TOKEN` | Docker Hub access token (read/write) |
| `VPS_HOST` | VPS public IP |
| `VPS_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | OpenSSH private key that can log in as `ubuntu` |

Staging Compose file: [`compose.staging.yml`](../compose.staging.yml) (`IMAGE_NAME` override optional; default `danielakanbi/expentra:staging`).

**CD production** (later): mirror the deploy workflow for `main` → `:production` and `/opt/expentra-production`.

**Checkpoint:** Actions tab shows green deploy; health endpoints still OK after a push to `staging`.

---

## Out of scope (for now)

- Full observability stack (Grafana / Prometheus / Loki)
- Frontend hosting
- Managed Postgres/Redis or a second VPS

---

## Session notes

Update this file when commands or layout change during tutoring. Current focus: **Phase 9b** (push workflows + `compose.staging.yml`, set GitHub secrets).
