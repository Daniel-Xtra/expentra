# 07 — Data Persistence

## 1. System of record

**PostgreSQL** is the authoritative store for all domain entities and the transactional outbox.

| Property | Value |
|----------|-------|
| ORM | TypeORM 0.3 |
| Config | `src/database/data-source.ts` |
| Schema sync | **Disabled** (`synchronize: false`) |
| Schema evolution | **Migrations only** under `src/database/migrations/` |
| Driver | `pg` |
| SSL | Optional via `POSTGRES_SSL*` envs |

---

## 2. Access patterns

There is **no separate repository package**. Pattern:

1. Entity classes decorated with TypeORM  
2. `TypeOrmModule.forFeature([...])` in the module that needs them  
3. Services inject `Repository<T>` or use `EntityManager` for multi-entity transactions  
4. Complex reads often live in `*QueryService` or `queries/` helpers  

**Transactions:** critical write paths open a manager/transaction, mutate domain rows, and `DomainEventPublisher.publish(..., { manager })` so outbox rows commit atomically with domain state.

---

## 3. Migrations

| Script (package.json) | Purpose |
|-----------------------|---------|
| `pnpm migration:run` | Apply pending (against compiled dist data-source) |
| `pnpm migration:revert` | Revert last |
| `pnpm migration:generate` | Generate from entity delta |
| `pnpm migration:show` | Show status |
| `pnpm migration:fresh` | Drop schema + re-run (dev only; flushes Redis) |
| `pnpm migration:fresh:seed` | Fresh + seed |

Docker: API entrypoint runs migrations when `RUN_MIGRATIONS=true`. Workers must **not** race migrations.

Naming convention in tree: sequential `17000000*.ts` migrations bootstrapping domains in dependency order (permissions → users → expenses → outbox, etc.).

---

## 4. Seeding

- Entry: `src/database/seed.ts` / `pnpm seed:run`  
- Super-admin from `SEED_SUPER_ADMIN_*` envs  
- Permissions and role templates from seed data files  

Use seed on empty environments only; never casually on production with wipe scripts.

---

## 5. Entity conventions

| Convention | Detail |
|------------|--------|
| PK | integer `id`, excluded from plain serialization where appropriate |
| Public ID | `reference` unique varchar |
| Soft operational flags | e.g. user `isActive`, `deactivatedAt` |
| Money | `bigint` + transformer to number in app; minor units |
| Relations | typed `@ManyToOne` / `@OneToMany` with join columns |
| Timestamps | `CreateDateColumn` / `UpdateDateColumn` common |

---

## 6. Redis responsibilities

Redis is **not** the system of record for domain entities.

| Use case | Module |
|----------|--------|
| BullMQ queue storage | `@nestjs/bullmq` |
| Rate limiting counters | `rate-limiter` |
| Auth context cache | auth cache service |
| Domain handler idempotency | outbox package |
| Health checks | readiness / queue health |

Operational note: `migration:fresh` flushes Redis because queue/idempotency keys would otherwise reference a wiped DB.

---

## 7. Backup & durability expectations (ops)

Architecturally:

- **Postgres** requires regular backups and point-in-time recovery as the sole durable business data store.  
- **Redis**: loss causes job redelivery / cache cold-start; outbox + retry design assumes at-least-once processing.  
- **Cloudinary**: object store durability for receipt binaries; DB holds pointers/metadata.

---

## 8. Schema change process (recommended)

1. Update entity models.  
2. Generate migration; review SQL carefully (esp. destructive changes).  
3. Ensure workers can tolerate mixed schema during rolling deploys (or deploy API+migrate first).  
4. Ship API image with migrations gated to **one** process (`RUN_MIGRATIONS` only on API task).  
5. Update architecture docs if public contracts change.
