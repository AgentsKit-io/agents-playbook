---
title: 'Chaos Engineering Pattern'
description: 'How to find failure modes before customers do — deliberately, in a controlled way.'
---

# Chaos Engineering Pattern

How to find failure modes before customers do — deliberately, in a controlled way.

## TL;DR (human)

Chaos engineering injects controlled faults (network blip, dependency timeout, region down) into a system that is observable and recoverable, and watches what happens. Done well, it surfaces hidden coupling and missing retries. Done badly, it is "production outages we caused". Start small, observe everything, increase scope only as confidence grows.

## For agents

### Preconditions

Before injecting any chaos:

1. **Observability** mature enough to see what failed and where ([`observability-pattern.md`](/docs/pillars/quality/observability-pattern)).
2. **SLOs** defined; error budget tracked.
3. **Rollback path** for any injection (turn it off immediately).
4. **Blast-radius limit**: per-injection scope is bounded (one service, one cell, one tenant — not the whole system).
5. **Stakeholder buy-in**: on-call, support, leadership know an injection is happening.

Without these, "chaos" is just "outage".

### Fault classes

| Fault | What it tests | Tooling |
|---|---|---|
| **Network latency injection** | Tolerance to slow dependencies | tc / Toxiproxy |
| **Network failure (drop)** | Retry + circuit-breaker behavior | tc / Chaos Mesh |
| **Service kill** | Failover behavior | kubectl delete pod, Chaos Monkey |
| **Disk fill** | Disk-pressure handling | Chaos Mesh |
| **CPU saturation** | Quality-of-service under load | stress-ng, Chaos Mesh |
| **Clock skew** | Time-sensitive logic | libfaketime |
| **Region down** | Multi-region failover | Cloud-provider region rollover |
| **DNS failure** | Resolver fallback | Toxiproxy, dnsmasq |
| **Database failover** | Connection-pool re-bind | Cloud-provider managed failover trigger |

### Game-day discipline

A game day is a scheduled session where the team:

1. **Hypothesises** what happens when fault X is injected.
2. **Injects** X.
3. **Observes** what actually happens.
4. **Diff** hypothesis vs reality.
5. **Documents** + fixes any discovered gaps.

Cadence: monthly for early-stage; quarterly when mature.

A game day that finds nothing is not a failure — it confirms current resilience. A game day that finds something is high-yield.

### Start small

Order of adoption:

1. **Staging**: inject in staging first. No customer impact.
2. **Production, off-peak, one cell**: smallest blast radius.
3. **Production, business hours, one cell**: tests on-call awareness.
4. **Production, multi-cell**: largest scope; only after years of practice.

Skipping steps is how chaos engineering becomes chaos.

### Hypothesis-first

For every injection, write the hypothesis first:

```
Hypothesis: When `payment-service` becomes unresponsive for 60s:
  - `/api/checkout` returns 503 with PAYMENT_UNAVAILABLE within 5s (circuit-break working).
  - Affected user count rises by < 0.1%.
  - `payment-service` recovers automatically within 30s of fault removal.
  - No data is lost; in-flight charges either complete or are correctly rolled back.
```

After the injection: did each prediction hold? Where it didn't, document the gap.

This forces explicit reasoning about resilience instead of "let's see what breaks".

### Specific fault recipes

**Dependency timeout test**:

- Inject 30s latency on the path to a non-critical service.
- Verify: caller times out after configured timeout, falls back to default, surfaces a clear UX message, does not pile up requests.

**Failover test**:

- Kill the primary DB.
- Verify: failover triggers within RTO; replicas catch up; no data lost within RPO; reads gracefully tolerate the transition window.

**Saturation test**:

- Drive traffic to 110% of normal.
- Verify: rate limits engage; back-pressure cleanly; SLOs degrade gracefully (not catastrophically); error rates rise but stay actionable.

**Region failure test**:

- Block traffic to one region.
- Verify: geo-DNS routes around; affected tenants experience a brief blip; cross-region replication is still consistent post-recovery.

### Continuous chaos

When mature, chaos becomes continuous, not scheduled:

- **Production traffic with built-in noise**: small random faults injected at all times (e.g. 1% of requests delayed 100ms).
- **Pre-deploy chaos sweep**: before promoting a release, run a battery of injections on the canary.

This builds resilience habit into the dev cycle: "I expect this to be reliable under noise" becomes the default mental model.

### What you learn

Game days repeatedly surface:

- **Missing timeouts**: a call without a timeout hangs forever; cascades.
- **Missing retries**: transient failures should retry with backoff; sometimes don't.
- **Retry storms**: every layer retries, multiplying load when the dependency comes back.
- **Circuit-breakers absent**: a degraded dependency should be skipped; sometimes isn't.
- **Coupling you didn't know about**: service A depends on service B implicitly (through a shared cache or library default).
- **UX during failure**: "something went wrong" instead of "your payment is being processed, give us 30 seconds".
- **Alerts that didn't fire**: the alert depended on the very system that failed.

Each finding produces an ADR / RFC / fix.

### Anti-patterns

- **"Chaos Monkey" without observability.** Pods die; nobody knows why. → Observability first.
- **Injecting in production with no rollback.** Outage. → Always have the kill-switch.
- **Hypothesis written after the fact.** Confirmation bias. → Hypothesis first.
- **Injecting in customer-impacting ways without notice.** Trust erosion. → Communicate; off-peak; minimal blast radius initially.
- **Single-handed chaos.** One engineer; everyone else surprised. → Team activity; everyone learns.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Kubernetes-native chaos | Chaos Mesh, LitmusChaos |
| Network proxy chaos | Toxiproxy |
| Cloud provider chaos | AWS Fault Injection Service, Azure Chaos Studio |
| Application-level chaos | Gremlin |
| Pod / process kills | Chaos Monkey (Netflix origin), Pumba |

### Common failure modes

- **Chaos in name only**: "we run game days" with no real injection. → Inject for real.
- **Chaos becomes a checkbox**: scheduled but the same scenarios every quarter. → Rotate scenarios; cover new surfaces as they ship.
- **No follow-up on findings**: game day surfaces issues; nothing changes. → Each finding gets an issue + owner.
- **Adoption too aggressive**: production chaos before staging chaos. → Phased; trust earned.

### See also

- [`observability-pattern.md`](/docs/pillars/quality/observability-pattern) — chaos without observation is malice.
- [`performance-budgets-pattern.md`](/docs/pillars/quality/performance-budgets-pattern) — chaos tests budget compliance under fault.
- [`../architecture/multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern) — failover drills are chaos.
- [`../security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — chaos events themselves are audit-worthy.
