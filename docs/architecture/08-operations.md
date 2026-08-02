# 08 — Operations

## 1. Runtime configuration

All env vars are validated at boot via Joi (`src/core/config/config.schema.ts`). Templates:

- `.env.example` — contract with comments  
- `.env.development` — local compose  

### Major env groups

| Group | Examples |
|-------|----------|
| App | `PORT`, `NODE_ENV`, `APP_URL`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `LOG_HTTP_REQUESTS` |
| Postgres | `POSTGRES_HOST`, `PORT`, `USER`, `PASSWORD`, `DB`, `LOGGING`, `SSL*` |
| Redis | `REDIS_URL` (preferred), host/port/TLS flags |
| JWT / auth | secrets, TTLs, registration flags, auth cache TTL |
| Rate limit | global limit + TTL |
| Cloudinary | cloud name, keys, receipt folder |
| Budgets | timezone, overspend block, alert thresholds |
| Approvals | escalation delay hours |
| Notifications | service URL + client id |
| SSO | enable + OIDC client parameters |
| Ops flags | `SWAGGER_ENABLED`, queue dashboard, `RUN_MIGRATIONS`, `RUN_SEED`, `APP_ROLE` |
| Seed | super-admin identity for first boot |

**Never** document real secret values in architecture docs.

---

## 2. Health & metrics

| Endpoint | Semantics |
|----------|-----------|
| `GET /api/health/live` | Process is running |
| `GET /api/health/ready` | Dependencies ok (Postgres, Redis, queue health) — may return **503** when degraded |
| `GET /api/metrics` | Prometheus metrics |

Staging compose uses healthchecks against live endpoint for API; worker may use Redis PING.

---

## 3. Logging & correlation

- Nest `Logger` throughout  
- Optional HTTP request logging (`LOG_HTTP_REQUESTS`)  
- **`X-Request-Id`** correlation middleware on all routes  
- Structured authz denial logging  
- Domain event payloads redacted for sensitive types  

---

## 4. Local development

```bash
pnpm install
# API
pnpm start:dev
# Worker (required for notifications, outbox, etc.)
pnpm start:worker:dev
```

Production-parity stack:

```bash
pnpm compose:up      # postgres, redis, api, worker
pnpm compose:logs
pnpm compose:down
```

| Service | Port |
|---------|------|
| API | 3200 |
| Postgres | 5432 |
| Redis | 6379 |

Tests: `pnpm test`, `pnpm test:e2e`, `pnpm test:cov`.

---

## 5. Docker image

- Multi-stage Dockerfile: deps → build → prod deps → slim runtime (Node 22)  
- `tini` as init; entrypoint waits for deps  
- Default/command runs API; worker overrides command  
- EXPOSE `3200`

---

## 6. CI/CD

### CI — `.github/workflows/ci.yml`

Typical: install, lint, build, unit tests on PRs / develop pushes.

### Staging deploy — `.github/workflows/deploy-staging.yml`

Trigger: push to `staging` (or manual).

Pipeline outline:

1. Build multi-arch or platform image with Docker Buildx  
2. Push to registry tags `staging` and `staging-<sha>`  
3. SSH to VPS  
4. Pull image and `docker compose -f compose.staging.yml up -d`  
5. Health curl verification  

Staging compose file: `compose.staging.yml` (project `expentra-staging`, host binds locked to localhost).

---

## 7. Branch strategy

| Branch | Role |
|--------|------|
| `feature/*` | Development |
| `staging` | Integration / VPS staging |
| `main` | Production candidate |

Flow: `feature/*` → PR → `staging` → PR → `main`.

Production promotion details: [VPS deploy guide](../vps-deploy-guide.md) (dual stack staging/prod on one VPS where applicable).

---

## 8. Operational runbooks (high level)

| Scenario | Response outline |
|----------|------------------|
| API ready 503 | Check Postgres/Redis connectivity; check SSL envs; confirm migrations applied |
| Events not firing | Ensure **worker** is running; inspect `outbox_events` statuses; check BullMQ/Redis |
| Duplicate emails | Check handler idempotency keys; inspect outbox duplicates |
| Migration failure on deploy | One API instance should run migrations; fix migration, re-deploy |
| Auth storm | Review rate limits; auth context cache TTL; Redis health |

---

## 9. Capacity notes

- Scale **API** replicas when HTTP concurrency is the bottleneck.  
- Scale **worker** replicas when queue lag grows (BullMQ concurrency settings matter).  
- Keep **exactly one** migration-owning start path (or coordinated job) to avoid migration races.  
- Postgres IOPS and connection counts grow with concurrent TypeORM clients × replicas.
