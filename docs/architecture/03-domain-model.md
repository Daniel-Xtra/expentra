# 03 — Domain Model

## 1. Bounded contexts

```text
┌─────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│  Identity & Access  │   │    Organization      │   │  Expense Lifecycle  │
│  User, Role, Auth,  │   │  Department, Budget, │   │  Expense, Receipt,  │
│  Permission         │   │  Manager history     │   │  Comment            │
└─────────────────────┘   └──────────────────────┘   └─────────────────────┘
                                        │                      │
                                        ▼                      ▼
                          ┌──────────────────────┐   ┌─────────────────────┐
                          │  Policy & Compliance │   │ Approval Workflow   │
                          │  ExpensePolicy,      │   │ Levels, Approvals,  │
                          │  Catalog fields      │   │ Delegations         │
                          └──────────────────────┘   └─────────────────────┘

Supporting: Notification · Audit · Reporting/Dashboard · Outbox (infra)
```

Contexts share one database (logical modularity inside a physical monolith). Module boundaries should not be violated by controllers reaching into another module’s internals; prefer public services and domain events for cross-context reaction.

---

## 2. Core entities (persistence)

| Entity | Table / concept | Notes |
|--------|-----------------|-------|
| `User` | users | Local password and/or OIDC; role; department; active flags |
| `Role` / `Permission` / `ParentPermission` | RBAC catalogue | Role ↔ permission M2M |
| `Department` | org units | Optional manager FK |
| `DepartmentManagerHistory` | manager changes | Auditability of org leadership |
| `DepartmentBudget` | annual dept budgets | Threshold alerts |
| `BudgetAlertDispatch` | alert fan-out bookkeeping | Dedup dispatch |
| `Expense` | expense aggregate root | Status machine; amount minor units |
| `ExpenseAttachment` | receipts | Cloudinary metadata |
| `ExpenseComment` | collaboration | Timeline comments |
| `ExpenseApproval` | decisions per level | Approve/reject records |
| `ApprovalLevel` | workflow definition | Order + approver type |
| `ApprovalDelegation` | temporary authority | Time-bounded |
| `ExpensePolicy` + catalog tables | compliance rules | Engine-driven |
| `Notification` / `NotificationPreference` | in-app | Preferences per user |
| `AuditLog` | security/business audit | Written via events |
| `OutboxEvent` | integration reliability | Transactional outbox |

Source: `src/database/entities/`.

---

## 3. Public identifiers (entity references)

Internal primary keys are **integers**. APIs and audit-facing links use **opaque references**:

```text
Format:  {PREFIX 3 chars}{timestamp ms 13 digits}{suffix 6 chars}
Example: EXP1749078456123A7B9C2
Pattern: /^[A-Z]{3}\d{13}[A-Z0-9]{6}$/
```

| Prefix | Entity |
|--------|--------|
| `usr` | User |
| `exp` | Expense |
| `rcp` | Receipt (attachment) |
| `dep` | Department |
| `rol` | Role |
| `bgt` | Budget |
| `apl` | Approval level |
| `apv` | Expense approval |
| `dlg` | Delegation |
| `epo` | Expense policy |
| `ntf` | Notification |
| `aud` | Audit log |
| … | See `EntityReferencePrefix` |

Defined in `src/database/constants/entity-reference-prefix.ts`. Assigned on insert via `assignEntityReference`.

**Why:** avoid sequential ID enumeration; stable public URLs; internal integrity stays simple with integer FKs.

---

## 4. Expense lifecycle

Statuses (`ExpenseStatus`):

```text
DRAFT ──submit──► SUBMITTED ──► UNDER_REVIEW ──► APPROVED ──► REIMBURSED
                      │               │
                      │               └── reject ──► REJECTED
                      │
                      └── (policy/submit path also may emit routing events)

REJECTED / terminal-ish states may support reopen back toward DRAFT (product rules in expense services).
```

| Status | Meaning |
|--------|---------|
| `DRAFT` | Editable by owner |
| `SUBMITTED` | Entered workflow |
| `UNDER_REVIEW` | Active approval levels in progress |
| `APPROVED` | Ready for finance reimbursment |
| `REJECTED` | Failed a level / process |
| `REIMBURSED` | Paid (domain terminal for finance path) |

### Money

- Stored as **integer minor units** (e.g. kobo for NGN) on `bigint` columns  
- Currency default `NGN` (ISO code column)  
- Never use floating point for stored amounts  

### Categories

`TRAVEL | MEALS | SUPPLIES | OTHERS`

### Approver types

`department_manager | finance_manager` (workflow level configuration)

---

## 5. Approval workflow

Configurable **approval levels** define ordered review steps and required approver role/type.

Runtime outcomes land on **`ExpenseApproval`** rows. Supporting features:

- **Bulk approve/reject** for power users with permission  
- **Delegations** — time-bounded handoff of approval authority  
- **Escalation** — worker job advances/stales overdue items (`expense.escalated`)  

Access to act on a specific expense is enforced by permission **plus** instance policies (`ExpenseAccessPolicy`, `ApprovalAccessPolicy`).

---

## 6. Budget model

- Budgets are **department-scoped**, typically annual.  
- Submit path can evaluate remaining capacity (`budget.overspend`, threshold events).  
- Config knobs (env): block submit on overspend, alert threshold percentages, timezone.  
- **Budget reconciliation** worker job revalidates operational consistency periodically.

---

## 7. Policy engine

Declarative rules separate compliance from hard-coded controller logic.

**Rule types** (`ExpensePolicyRuleType`):

| Type | Intent |
|------|--------|
| `CONDITIONAL` | Field/expression based gates |
| `RECEIPT_REQUIRED` | Attachment mandatory under conditions |
| `CATEGORY_MONTHLY_CAP` | Per-category spend limits |
| `WEEKEND_TRAVEL_JUSTIFICATION` | Weekend travel rules |
| `DUPLICATE_DETECTION` | Likely-duplicate detection |

**Severity:**

- `BLOCK` — reject submit  
- `WARN` — allow with recorded exceptions / hints  

Engine lives under `src/modules/policy/engine/` with field resolvers (amount, category, attachments, monthly spend, weekday, duplicates, etc.). Policy **catalog** stores reusable condition fields and rule templates for UI builders.

---

## 8. Auth principal

Request-scoped identity after JWT strategy rehydration:

```typescript
// src/definition.ts
interface IAuthUser {
  id: number;
  reference: string;
  email: string;
  role: string;
  roleId: number;
  isActive: boolean;
  deactivatedAt?: Date;
  isEmailVerified: boolean;
  departmentId?: number | null;
  managedDepartmentIds: number[];
  permissions: { action: string; resource: string; scope: string }[];
}
```

`managedDepartmentIds` enables org-level grants (e.g. department managers approving team expenses) without separate permission rows for every team action.

---

## 9. Domain events (integration)

Events are published via `DomainEventPublisher` → outbox (not in-process EventEmitter for reliability-critical work).

| Event type (representative) | Typical consumers |
|-----------------------------|-------------------|
| `expense.submitted` / `expense.pending_finance` / `expense.approved` / `expense.rejected` / `expense.reimbursed` / `expense.escalated` / `expense.reopened` | Notifications, audit, routing |
| `expense.comment.added` | Notifications, audit |
| `expense.budget_committed` | Budget side-effects |
| `budget.overspend` / `budget.threshold_crossed` | Alerts / notifications |
| `auth.email-verification` / `auth.password-reset` | Email (sensitive fields redacted in logs) |
| `delegation.created` / `delegation.revoked` | Audit |
| `user.suspended` / `user.activated` / dept-change / role-change | Notifications, audit |
| Department manager change events | Notifications, audit |
| Role permission change events | Cache invalidation / audit paths |

Handlers register through **registrar** classes on module init (`*DomainEventRegistrar`) into `DomainEventHandlerRegistry`.
