---
title: 'Multi-Tenant Isolation Pattern'
description: 'How to host many customers in one system without one customer leaking, blocking, or paying for another.'
---

# Multi-Tenant Isolation Pattern

How to host many customers in one system without one customer leaking, blocking, or paying for another.

## TL;DR (human)

Three isolation dimensions: data (no cross-tenant reads), resource (no noisy neighbor), and blast radius (one tenant's incident does not break others). Achieved layer-by-layer: tenant id in every row + RLS at the database, per-tenant quotas at the API, cell-based deployment at the infra. Cost and complexity rise with each layer; pick the level that matches your contractual promises.

## For agents

### Three isolation dimensions

| Dimension | Question | Failure mode if violated |
|---|---|---|
| **Data** | Can tenant A read tenant B's data? | Confidentiality breach |
| **Resource** | Does tenant A consume so much CPU / DB / network that B slows? | Noisy-neighbor degradation |
| **Blast radius** | If tenant A's request crashes a service, does B's traffic also fail? | Shared-fate outage |

Each is achieved at a different layer. Strong systems address all three.

### Data isolation — three tiers

**Tier 1 — Tenant column + application-level filter.**

Every tenant-owned table has a `workspace_id` (or `tenant_id`) column. Every query filters by it. The application enforces.

Pros: simple, cheap, one DB.
Cons: a single missing `WHERE workspace_id = ?` leaks. Audit must catch every query.

**Tier 2 — Row-level security (RLS).**

Tier 1 + the database enforces. Postgres RLS, MySQL with policies, ORM that injects the tenant clause from session context.

```sql
CREATE POLICY tenant_isolation ON workspace_data
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
ALTER TABLE workspace_data ENABLE ROW LEVEL SECURITY;
```

The application sets `app.workspace_id` on connection; queries that forget the filter are still scoped.

Pros: defense in depth; application bug does not = leak.
Cons: ORM compatibility varies; debugging "why empty?" needs awareness of RLS.

**Tier 3 — Per-tenant database / schema.**

Each tenant gets their own database (or own schema in the same database). Connection pool routes by tenant.

Pros: hardest to leak; per-tenant backup; data sovereignty trivial.
Cons: migrations N× (one per tenant); ops overhead; cross-tenant analytics expensive.

Most products use Tier 1 + Tier 2. Tier 3 for enterprise + compliance regimes.

### Where the tenant id comes from

**From the session, never from the body.**

The tenant id is part of the verified principal context. The application sets it on every DB connection from that context.

```ts
// ✓ tenant from session
async function handler(params, ctx) {
  const workspaceId = ctx.principal.activeWorkspaceId;
  await db.workspace_data.list({ where: { workspace_id: workspaceId } });
}

// ✗ tenant from body — never
async function handler({ workspaceId, ... }) { ... }
```

This is the same rule as security Rule 2 (`universal.md`). It is the single most important practice in multi-tenant systems.

### Resource isolation — per-tenant quotas

Without quotas, one tenant's heavy workload starves the rest.

Levels:

1. **API rate limits per tenant**: requests / second; concurrent requests; burst budget.
2. **DB query budget per tenant**: max query runtime; max rows scanned; circuit-break on excess.
3. **Background job concurrency per tenant**: at most N parallel jobs.
4. **Storage / compute quotas**: max records, max storage, max embedding cost — tied to plan.

When a tenant hits a quota:

- Return a clear error: `code: "QUOTA_EXCEEDED"`, hint: which quota, when it resets, how to raise.
- Audit-log the event.
- Optionally page the customer (their app is breaking; they may not realize).

### Blast radius — cell-based deployment

When one tenant's bug crashes a service, every other tenant in that service goes down too. Cell-based deployment limits blast radius:

- **Cell** = a fully isolated stack (services + databases + caches) serving a subset of tenants.
- Tenants are sharded across cells (by ID range, by region, by plan tier).
- A bad deploy / crash takes down one cell; others continue.

Three deployment models:

| Model | Blast radius | Cost |
|---|---|---|
| **Single shared stack** | All tenants | Lowest |
| **Cells of N tenants each** | One cell | Medium |
| **Single-tenant stack** | One tenant | Highest |

Cells of ~hundreds-to-thousands of tenants strike a balance. Enterprise customers often pay for single-tenant.

Cell-based requires:

- Per-cell deployment pipeline.
- Tenant-to-cell routing (sticky; documented).
- Per-cell monitoring + on-call.
- Cell-migration tooling (moving tenants between cells when one fills).

### Noisy-neighbor detection

Even with quotas, some tenants find the loophole. Detect:

- **Per-tenant resource attribution** in metrics — every metric is tagged with tenant id.
- **Top-N consumers dashboard** — refresh every 5 min; flag anomalies.
- **Spike detection** — sudden 10× increase from a tenant triggers an alert.

Common loopholes:

- Tenant orchestrates many cheap requests that add up.
- Tenant creates a workflow that retries forever.
- Tenant uploads a file that triggers expensive processing.

For each, adjust the quota or fix the bug.

### Plan tier interaction

Quotas often map to plan tiers. Free vs Pro vs Enterprise have different limits.

- **Plan-derived quotas in code**: query the plan registry; enforce at request time.
- **Tier signaling in errors**: when a quota fires, tell the user "this is a Pro feature" with an upgrade path.
- **Audit changes to quotas**: an admin raising a tenant's quota is logged.

Mix plan tier with feature flags — but as separate concepts (see [`../architecture/feature-flags-pattern.md`](/docs/pillars/architecture/feature-flags-pattern)).

### Cross-tenant queries (rare, audited)

Some operations are necessarily cross-tenant: a marketplace listing, support viewing customer data, system analytics.

Rules:

- Require `cross_tenant_read` capability (separate from per-tenant read).
- Audit-log every cross-tenant read with the operator + reason.
- Sometimes require step-up auth (re-prompt 2FA).
- Aggregated analytics: anonymise / de-identify before crossing tenant boundary.

### Data residency (special case)

Sovereignty rules (GDPR, LGPD, data-in-country) mandate that some tenants' data must not leave a region. Implement:

- Per-tenant `region` field.
- Connection routing: tenant in region X → DB in region X.
- The tenant-id-from-session middleware also resolves the region.
- Cross-region access blocked at the network layer (not just app).

See [`../architecture/multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern).

### Common failure modes

- **Tenant id from body.** Caller fabricates id; cross-tenant read. → Always from session.
- **RLS forgotten on a table.** Application filters; one forgotten query leaks. → All tenant-owned tables have RLS; gate scans for missing policies.
- **No quotas.** One tenant burns the DB; everyone slow. → Per-tenant quotas + circuit breakers.
- **Cells share a cache, key not tenant-prefixed.** Tenant A's cached page served to tenant B. → Cache key always includes tenant id.
- **Cross-tenant query in shared analytics.** PII from tenant A appears in tenant B's dashboard. → Anonymize at the boundary; audit access.
- **Single-tenant offered without per-tenant tooling.** "We added one customer's own DB" → next migration breaks them. → Tooling for single-tenant ops first.

### Adoption path

1. **Day 0**: tenant id in every table. Tenant-id-from-session middleware. Audit every query in code review.
2. **Month 1–3**: enable RLS on tenant-owned tables.
3. **Month 6+**: introduce per-tenant quotas + rate limiting.
4. **As you grow**: cell-based deployment; per-tenant region routing for sovereignty.

Skipping ahead (cell-based without RLS) is overhead without benefit. Sequence matters.

### See also

- [`universal.md`](/docs/pillars/security/universal) — Rule 2 (tenancy from session).
- [`rbac-pattern.md`](/docs/pillars/security/rbac-pattern) — capability scope can include tenant.
- [`audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — cross-tenant reads audited.
- [`../architecture/distributed-data-pattern.md`](/docs/pillars/architecture/distributed-data-pattern) — sharding by tenant id.
- [`../architecture/multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern) — region-aware tenancy.
- [`data-classification-pattern.md`](/docs/pillars/security/data-classification-pattern) — what data needs which isolation tier.
