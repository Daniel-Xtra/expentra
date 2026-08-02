# Expentra Backend — Architecture Documentation

**Audience:** system architects, backend engineers, SRE/platform, security reviewers  
**Scope:** this repository only (NestJS HTTP API + BullMQ worker)  
**Frontend:** sibling project `../expentra-web`  
**Last structural review:** based on codebase as of documentation authoring

---

## What this system is

Expentra is an **internal expense management platform**. Employees draft and submit expenses with receipts; managers and finance approve or reject; finance reimburses approved claims. Supporting capabilities include department budgets, configurable compliance policies, role-based access, audit trails, notifications, and reporting.

This repository is a **modular monolith** with **two runtime processes** sharing one codebase and Docker image:

| Process | Entry | Role |
|---------|-------|------|
| **API** | `src/main.ts` → `dist/main.js` | Synchronous HTTP (REST `/api/v1`) |
| **Worker** | `src/worker.ts` → `dist/worker.js` | Asynchronous BullMQ consumers |

---

## Document map

| Document | Contents |
|----------|----------|
| [01 — System overview](./01-system-overview.md) | Business context, C4 container view, tech stack, architectural style |
| [02 — Runtime & application structure](./02-runtime-application.md) | Module layout, request pipeline, process boundaries |
| [03 — Domain model](./03-domain-model.md) | Bounded contexts, entities, expense lifecycle, identifiers |
| [04 — API surface](./04-api-surface.md) | REST conventions, route catalogue, response envelope |
| [05 — Security & access control](./05-security.md) | AuthN, AuthZ (CASL-style RBAC), secrets, CORS, hardening |
| [06 — Async messaging & integrations](./06-async-and-integrations.md) | Transactional outbox, queues, external systems |
| [07 — Data persistence](./07-data-persistence.md) | PostgreSQL, TypeORM, migrations, Redis use-cases |
| [08 — Operations](./08-operations.md) | Config, health, metrics, Docker, CI/CD, branch strategy |

**Related (ops runbook):** [VPS deploy guide](../vps-deploy-guide.md)

---

## Architecture decisions at a glance

1. **Modular monolith, not microservices** — domain modules under one deployable unit; scale by API/worker process count.
2. **Dual process** — HTTP handlers stay lean; background work never blocks request threads.
3. **Transactional outbox** — side effects (email, audit, routing) are written to Postgres in the same transaction as domain changes, then relayed to Redis/BullMQ.
4. **Deny-by-default authorization** — every protected route declares permissions or an explicit authenticated bypass.
5. **Public opaque references** — external APIs use time-stamped references (`EXP…`, `USR…`); internal FKs stay integer PKs.
6. **Schema only via migrations** — `synchronize: false`; migrations run from the API container on deploy when enabled.
7. **Config as contract** — all env validated at boot via Joi (`src/core/config/config.schema.ts`).

---

## Quick path map

```text
src/
├── main.ts / worker.ts          # Process entry points
├── app.module.ts                # API composition root
├── worker.module.ts             # Worker composition root
├── definition.ts                # Shared principal (IAuthUser)
├── core/                        # Cross-cutting infrastructure
├── database/                    # Entities, migrations, seeders
├── modules/                     # Domain feature modules
└── queues/                      # Worker-only BullMQ registration
```
