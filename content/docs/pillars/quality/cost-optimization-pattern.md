---
title: "Cost Optimization Pattern (FinOps)"
description: "How to control cloud spend without micromanaging every commit."
---

# Cost Optimization Pattern (FinOps)

How to control cloud spend without micromanaging every commit.

## TL;DR (human)

Cloud spend without FinOps doubles every 18 months on autopilot. Discipline: per-team budget; per-tenant attribution; per-workload right-sizing; commitments + spot for predictable load; caching + query budgets; CI runs cost-aware too. The goal is "spend roughly what we said we'd spend" — not minimise at all cost.

## For agents

### Three FinOps phases (the FinOps Foundation framework)

| Phase | Question | Tools |
|---|---|---|
| **Inform** | Where is the money going? | Cost dashboards; per-service / per-team / per-tenant attribution |
| **Optimize** | What can we cut without harm? | Right-sizing; commitments; spot; cache; query reduction |
| **Operate** | How do we keep it that way? | Budgets; alerts; per-PR cost gates; FinOps rituals |

Most teams skip straight to Optimize; that's wrong. Inform first; without attribution, optimization is guesswork.

### Inform — cost attribution

Every dollar should answer:

- **Service**: which microservice / Lambda / managed service.
- **Environment**: prod / staging / dev.
- **Team**: who owns it; who reviews bills.
- **Tenant** (multi-tenant systems): which customer drives the cost.
- **Feature / surface** (optional but powerful): which product surface.

Achieved via:

- **Cloud tags / labels**: applied to every resource at creation time; enforced via IaC (Terraform, Pulumi, CDK).
- **Per-request tagging**: spans / logs / metrics carry tenant + service tags.
- **Cost allocation reports**: cloud-native (AWS Cost Explorer, GCP Billing, Azure Cost Management) + per-tenant rollup.

Untagged resources = mystery costs. Hard rule: no untagged resources in production.

### Per-tenant attribution

In multi-tenant SaaS, per-tenant cost drives:

- **Pricing**: usage-based or tier-based pricing depends on cost knowledge.
- **Customer success**: tenants spending 10× more than they pay are flight risks (acquisition cost will outweigh).
- **Capacity planning**: who would grow + how much.
- **Quota tuning**: where to put limits.

Computed from observability tags (per [`observability-pattern.md`](./observability-pattern.md)). Roll up nightly into a per-tenant cost table.

### Right-sizing

Most workloads over-provision. Symptoms:

- CPU steady < 30%.
- Memory steady < 50%.
- Network rarely saturated.

Right-sizing process:

1. Measure: 30+ days of utilisation per instance / service.
2. Recommend: smaller instance class; lower memory; fewer replicas.
3. Stage: change in staging; measure.
4. Promote: change in production with rollback path.

Hold a reasonable cushion (50–70% utilisation steady-state; lower for spiky workloads).

Auto-scaling helps but only when:

- Cold-start is acceptable (sub-minute scale-up).
- Stateless workload.
- Predictable load shape.

### Commitments + spot

Cloud providers reward predictability:

- **Reserved instances / commitments** (1y, 3y): 30–70% off list price.
- **Spot instances**: 60–90% off; reclaimed on short notice.

Mix:

- **Steady baseline**: covered by commitments (~70% of capacity).
- **Burst above baseline**: spot or on-demand.
- **Stateful / critical**: on-demand or reserved; never spot.

Commitments are a forecasting bet. Under-commit and miss the discount; over-commit and pay for unused capacity. Default to under-committing.

### Query + storage budgets

In data-heavy systems, database cost often dominates compute.

Per-endpoint discipline (extends [`performance-budgets-pattern.md`](./performance-budgets-pattern.md)):

- **Query count budget** per request (N+1 detection: > 20 = probable bug).
- **Bytes scanned budget** per request (avoid full-table scans).
- **Result size budget** (paginate everything; max 100 rows per page default).
- **Cold storage tier** for data > 90 days unused.
- **Compression**: enable everywhere it pays (most columnar stores).

Per-tenant query budgets prevent noisy-neighbor cost spikes:

- Max query CPU-time per tenant per minute.
- Max bytes scanned per tenant per hour.
- Circuit-break at limit; surface as `QUOTA_EXCEEDED` (see [`../security/multi-tenant-isolation-pattern.md`](../security/multi-tenant-isolation-pattern.md)).

### Egress + data transfer

Often the surprise on cloud bills:

- Cross-region transfer: usually expensive.
- Egress to internet: expensive at scale.
- Cross-AZ transfer: sometimes free, sometimes not.

Mitigations:

- Keep data hot in the same region / AZ as the consumer.
- CDN for public assets (one-time push; cheap edge serving).
- Avoid cross-region replication for non-critical data.
- Compress on the wire.

### Background jobs + queues

Cheaper than synchronous:

- Async background jobs scale on cheaper compute (spot OK).
- Queues buffer bursts; smooth provisioning.
- Job retries are cheap when the work is idempotent.

Discipline:

- Idempotency-key on every job (replays don't double-charge).
- Dead-letter queue for permanently failing jobs.
- Visibility into queue depth + worker utilisation.

### Cache hit rate

A cache pays for itself when:

- Hit rate > 60% in steady state.
- Origin compute / DB cost per request > cache cost per request.

Measure cache hit rate per cache; track over time. Hit rate drops are signals (key churn, app pattern change, eviction pressure).

See [`../architecture/distributed-data-pattern.md`](../architecture/distributed-data-pattern.md) for cache tiers.

### Dev / CI cost

Often overlooked:

- **CI minutes**: cache aggressively (per [`ci-cd-pipeline-pattern.md`](./ci-cd-pipeline-pattern.md)).
- **Per-PR ephemeral environments**: convenient but expensive; lifecycle them (auto-tear-down after N days).
- **Dev databases**: long-running instances; sleep / terminate on no-activity.
- **Build artefact storage**: tier old artefacts to cold; expire after N versions.

A 10× cost gap exists between "every team has its own everything 24/7" and "shared dev infrastructure with lifecycle policies".

### Cost gates

Beyond budgets, per-PR cost signals:

- **Bundle size increase** → bandwidth + CDN cost.
- **New cloud resources** in IaC diff → manual review.
- **New paid service dependency** → PR comment with monthly estimate.
- **Performance regression** → potentially higher per-request cost.

These extend the gate suite (see [`quality-gates-pattern.md`](./quality-gates-pattern.md)).

### FinOps rituals

| Cadence | Activity |
|---|---|
| Daily | Cost-anomaly alerts trigger on spike |
| Weekly | Top spenders dashboard reviewed |
| Monthly | Per-service / per-team budgets reviewed |
| Quarterly | Commitments + right-sizing review |
| Annually | Cloud-provider contract negotiation; multi-cloud strategy review |

### Anomaly detection

A 2× cost spike in 24h means something changed. Possible causes:

- New deploy with a query regression.
- A customer's traffic spike (good or bad).
- A bug producing infinite retries.
- A test inadvertently shipped that hits an expensive path.
- Account compromise (cryptominer; spam).

Anomaly alert routes to the team that owns the service. SEV depends on magnitude:

- 1.5× = warn.
- 3× = SEV-3.
- 10× = SEV-1 (probable runaway or compromise).

### Cost-per-X metrics

Useful tracking metrics:

- **Cost per active user** (DAU / MAU).
- **Cost per request**.
- **Cost per tenant** (per pricing-tier).
- **Cost per transaction** (for products with discrete units of value).

Surface these in dashboards alongside business metrics. Engineering leadership reasons about cost in product terms.

### Multi-cloud caveat

Multi-cloud is sometimes proposed for cost. Reality:

- Cross-cloud egress is expensive; data gravity locks you in.
- Operations cost (per-cloud expertise, tooling) often exceeds savings.
- Single-cloud + multi-region usually delivers most of the resilience.

Adopt multi-cloud for sovereignty / vendor risk / specific service needs — not for cost.

### Common failure modes

- **No tagging**. Cost mystery; cannot attribute. → Enforce in IaC.
- **Over-provisioning on autopilot**. Auto-scaling configured min ≥ peak; never scales down. → Right-size min.
- **No budgets**. Bills surprise leadership. → Per-team budget; alerts at 50/75/90%.
- **Cost work treated as separate from engineering**. → Engineers see their cost; act on it.
- **Optimisations that break SLOs**. Cost down; quality down. → Cost is constrained-by SLO, not above it.
- **Spot for stateful**. Reclaimed mid-write. → On-demand for state; spot for stateless.
- **Cross-region traffic accidental**. Service in region A calls DB in region B. → Network policy + alert.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Cloud-native cost | AWS Cost Explorer + Budgets, GCP Billing, Azure Cost Management |
| Per-resource analysis | Vantage, Infracost, CloudHealth, Spot.io |
| Per-Kubernetes pod cost | Kubecost, OpenCost |
| Anomaly detection | CloudZero, native cloud anomaly alerts |
| Per-tenant attribution | In-house roll-up from observability tags |
| Right-sizing recommendations | AWS Compute Optimizer, GCP Recommender |
| FinOps governance | FinOps Foundation framework |

### Adoption path

1. **Day 0**: tag everything; one budget per environment.
2. **Month 1**: per-service attribution; top-spenders dashboard.
3. **Quarter 1**: right-sizing review; first commitments / reservations.
4. **Quarter 2**: per-tenant attribution; cost-per-X dashboards.
5. **Quarter 3+**: PR-level cost signals; cost-aware feature design.
6. **Mature**: FinOps team / role; engineering OKRs include cost.

### See also

- [`performance-budgets-pattern.md`](./performance-budgets-pattern.md) — performance and cost overlap heavily.
- [`observability-pattern.md`](./observability-pattern.md) — tags drive cost attribution.
- [`../security/multi-tenant-isolation-pattern.md`](../security/multi-tenant-isolation-pattern.md) — per-tenant quotas.
- [`../architecture/distributed-data-pattern.md`](../architecture/distributed-data-pattern.md) — cache + replica costs.
- [`ci-cd-pipeline-pattern.md`](./ci-cd-pipeline-pattern.md) — CI cost.
