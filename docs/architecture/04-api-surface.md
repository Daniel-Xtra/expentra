# 04 — API Surface

## 1. Style and versioning

| Aspect | Convention |
|--------|------------|
| Style | REST over JSON |
| Global prefix | `/api` |
| Versioning | URI — default `v1` → `/api/v1/...` |
| Version-neutral | Health & metrics: `/api/health/*`, `/api/metrics` |
| Auth header | `Authorization: Bearer <access_token>` |
| Refresh | HttpOnly cookie `refreshToken` |
| Trace | `X-Request-Id` (in/out) |
| Idempotency | `Idempotency-Key` on protected mutations when `@Idempotent()` applied |

OpenAPI/Swagger: optional at `/api/docs` when `SWAGGER_ENABLED` is true.

---

## 2. Response envelope

Successful and error responses share a consistent shape (`IResponse`):

```typescript
{
  success: boolean;
  statusCode: number;
  message: string;
  code?: string;          // machine-readable error code
  data?: T;
  meta?: unknown;         // pagination, export job refs, etc.
  errors?: Array<{ field: string; message: string }>;
}
```

Applied by `TransformInterceptor` and `HttpErrorFilter`.

---

## 3. Resource route catalogue

Base path examples use **v1**.

### Auth — `/api/v1/auth`

| Method | Path | Notes |
|--------|------|-------|
| GET | `sso/status` | SSO availability |
| GET | `sso/start` | Begin OIDC |
| GET | `sso/callback` | IdP return |
| POST | `sso/exchange` | Opaque code → tokens |
| POST | `sign-up` | Optional public registration |
| POST | `sign-in` | Local credentials |
| POST | `tokens/refresh` | Cookie refresh |
| POST | `sign-out` | Invalidate session |
| POST | `email-verifications/confirm` / `resend` | Verify email |
| POST | `password-resets` / `validate` / `confirm` | Reset flow |

### Users — `/api/v1/users`

| Method | Path | Notes |
|--------|------|-------|
| GET/PATCH | `me` | Self profile |
| PATCH | `me/password` | Change password |
| GET | `` , `status-counts` | Admin list |
| POST | `export` | Async/bulk export |
| GET | `:reference/summary` | User summary |
| PATCH | `:reference` | Admin update |

### Roles — `/api/v1/roles`

Permissions catalogue, templates, CRUD, permission assignment, template apply.

### Departments — `/api/v1/departments`

CRUD, export, and **managed** manager dashboards:

- `managed`, `managed/:reference/team-dashboard`, budget summary/forecast, users, manager history  

### Expenses — `/api/v1/expenses`

| Area | Paths |
|------|-------|
| Create/list (self) | `POST /`, `GET me`, `GET me/status-counts`, `POST me/export` |
| Admin/list | `GET /`, `GET status-counts`, `POST export` |
| Policy helpers | `GET policy-hints`, `POST check-duplicate` |
| Finance | `GET finance-queue/summary`, `POST approved/payroll-export`, `POST reimburse/bulk` |
| Pending approval | `GET pending-approval`, `GET pending-approval/summary` |
| Instance | `GET/PATCH/DELETE :reference` |
| Lifecycle | `POST :reference/submit`, `submit/check`, `reopen`, `reimburse` |
| Collaboration | comments, policy-exceptions, activity |

### Receipts — nested under expenses

Typical pattern: `/api/v1/expenses/:expenseReference/receipts` — upload, list, view, download, delete.

### Approvals — `/api/v1/approvals`

- `POST :expenseReference/approve|reject`  
- `POST bulk-approve` / `bulk-reject`  

### Approval levels — `/api/v1/approval-levels`

CRUD, impact preview, workflow health, export.

### Delegations — `/api/v1/approval-delegations`

Create, list mine / delegated-to-me, revoke.

### Budgets — `/api/v1/budgets`

CRUD (via post/list/patch), org summary/by-department/forecast, personal summary, export.

### Policies — `/api/v1/policies` + `/api/v1/policies/catalog`

Rule CRUD; catalogue for condition fields and rule templates.

### Notifications — `/api/v1/notifications`

List, unread count, mark read / read-all, preferences.

### Reports — `/api/v1/reports`

Spending summary, monthly, by category/department; Excel/PDF export.

### Dashboard — `/api/v1/dashboard`

Personal dashboard + export.

### Audit — `/api/v1/audit-logs`

Filtered list; by resource reference.

### Authorization — `/api/v1/authorization`

`me` (effective permissions), access-review (+ export).

### Ops (version neutral)

| Path | Purpose |
|------|---------|
| `GET /api/health/live` | Liveness |
| `GET /api/health/ready` | Readiness (Postgres + Redis) |
| `GET /api/metrics` | Prometheus scrape |

---

## 4. Design conventions for new endpoints

1. Place under existing domain module unless a new bounded context is justified.  
2. Use `:reference` params with `EntityReferencePipe` / validation pattern.  
3. Declare `@RequirePermission(action, resource)` or `@AllowAuthenticated()` / `@Public()`.  
4. Return via `successRequestResponse` helper patterns already in the codebase.  
5. For multi-step mutations with risk of double-submit, apply `@Idempotent()`.  
6. Prefer **minor units** for any monetary input/output fields (document unit in DTO description).  
7. Side effects after commit: publish domain events through the outbox, do not call Redis-dependent notification directly from transactional path unless deliberately fire-and-forget (prefer outbox).

---

## 5. Client generation / samples

- `pnpm generate:postman` — Postman collection generator  
- Optional Swagger when enabled  
- README historically referenced `docs/api-post-payloads.md` (ensure regenerated or maintained if referenced in runbooks)
