# 05 — Security & Access Control

## 1. Threat model assumptions

- Attack surface is primarily **browser SPA → API** over HTTPS (TLS terminated at reverse proxy in staging/prod).  
- Users are organization members (employees, managers, finance, admins).  
- Secrets live in environment/config store, **never** in compose files as hard-coded credentials.  
- Receipt binaries live in Cloudinary; API stores metadata/links.

---

## 2. Authentication

### Local credentials

- Email + password  
- Passwords hashed with **bcryptjs**  
- Optional public sign-up (`ALLOW_PUBLIC_REGISTRATION`)

### Tokens

| Artifact | Transport | Purpose |
|----------|-----------|---------|
| Access token | `Authorization: Bearer` | API authorization for each request |
| Refresh token | HttpOnly cookie `refreshToken` | Silent session extension |

Config: `JWT_SECRET`, `JWT_REFRESH_SECRET`, expires-in env vars. Cookie `secure` in production; `sameSite: 'lax'`.

### Account status

`AccountStatusGuard` after JWT:

- Requires email verification (except routes with `@SkipEmailVerification`)  
- Rejects suspended / inactive accounts  

### OIDC SSO (optional)

When `SSO_ENABLED=true`:

```text
GET /auth/sso/start → IdP → GET /auth/sso/callback → POST /auth/sso/exchange → tokens
```

Config includes issuer, client id/secret, redirect URI, scopes, auto-provision flags, allowed email domains, button label.

### Auth context cache

JWT strategy rehydrates full `IAuthUser` (including permissions and managed departments) from DB with optional **Redis auth-context cache** (`AUTH_CONTEXT_CACHE_TTL_SECONDS`) for lower auth latency.

---

## 3. Authorization model

### Permission triples

```text
action × resource × scope
```

**Actions** (`PermissionAction`):  
`manage`, `create`, `read`, `update`, `delete`, `submit`, `approve`, `reject`, `reimburse`, `export`, `mark`, `upload`

**Resources** (`PermissionResource`):  
`all`, `expense`, `user`, `approval`, `approval_level`, `receipt`, `notification`, `budget`, `report`, `department`, `role`, `audit`, `policy`, `dashboard`

**Scopes** (`PermissionScope`):

| Scope | Meaning |
|-------|---------|
| `global` | Organization-wide for that action/resource |
| `self` | Limited to own records |

Roles bind sets of permissions. Parent permission resources group UI “management areas” for navigation/capability surfaces.

Seed catalogue: `src/database/seeders/data/permissions.seed-data.ts`  
Capability codegen: `pnpm generate:capabilities`

### Guard policy

Global **`AccessGuard`** is **deny-by-default**:

- Route must set `@RequirePermission(...)` handler metadata, **or**  
- `@AllowAuthenticated()` for any valid logged-in user, **or**  
- `@Public()` to skip auth (and access)  

`manage` on `all` implies superuser-style breadth where granted.

### Runtime abilities

`AbilityFactory` / builders construct per-request capabilities. **Organization grants** (e.g. department manager) can grant approval-related abilities without a literal DB permission row for every department.

### Instance policies

Even with global approve permission, handlers may invoke **resource instance policies** to ensure:

- Expense is in correct status  
- Actor is the assigned/eligible approver (or delegate)  
- Department boundaries for managers  

---

## 4. Global guard chain

| Order | Guard | Behavior |
|-------|-------|----------|
| 1 | `JwtAuthGuard` | Authenticate unless `@Public()` |
| 2 | `AccountStatusGuard` | Verified + active |
| 3 | `RateLimitGuard` | Global + decorator overrides (Redis) |
| 4 | `AccessGuard` | Permission / allow-authenticated |

Authz denials can emit structured logs (`event: authz_denied`).

---

## 5. Transport & edge security

| Control | Implementation |
|---------|----------------|
| HTTP headers | Helmet via `createSecurityConfig` |
| CORS | `ALLOWED_ORIGINS` allowlist; credentials true |
| Proxy | `TRUST_PROXY` for correct client IP / rate limit |
| Allowed headers | Content-Type, Authorization, X-Request-Id, Idempotency-Key, … |
| Methods | GET, PATCH, POST, DELETE |
| Input | ValidationPipe; production forbids unknown properties, suppresses raw validator messages |
| Sensitive logs | Domain-event redaction for password-reset / email-verification payloads |

---

## 6. Secrets & configuration hygiene

- Validated at boot (`configValidationSchema`) — missing/invalid env fails fast.  
- Compose files set **topology only**; credentials from env files / CI secrets.  
- Staging deploy must inject secrets on the VPS; image itself contains no secrets.  
- Never commit `.env` with production credentials.

---

## 7. Queue dashboard

Bull Board may be enabled for operators; protect with basic auth credentials from env (`QUEUE_DASHBOARD_*`). Treat as privileged surface; do not expose publicly without auth and network restriction.

---

## 8. Security checklist for new features

- [ ] Correct `@Public` / `@AllowAuthenticated` / `@RequirePermission`  
- [ ] Instance-level ownership checks if resource is user-scoped  
- [ ] Monetary and PII fields not logged raw  
- [ ] Idempotency on double-submit sensitive POST  
- [ ] Domain events for side effects (auditable path)  
- [ ] No secrets in error messages returned to clients  
