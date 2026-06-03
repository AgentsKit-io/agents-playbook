---
title: 'Observability Pattern'
description: 'How to know what the system is doing in production, beyond ''tests passed''.'
---

# Observability Pattern

How to know what the system is doing in production, beyond "tests passed".

## TL;DR (human)

Three signals: **metrics** (counters/gauges/histograms, low cardinality), **logs** (events, structured, queryable), **traces** (request spans across services). Define SLOs (Service-Level Objectives) that capture user-perceived correctness; alert on SLO burn rate, not on noisy thresholds. Per-tenant attribution is mandatory in multi-tenant systems.

## For agents

### The three signals

| Signal | Question it answers | Storage shape | Volume |
|---|---|---|---|
| **Metrics** | "How is the system trending?" | Time series, aggregated | Low (cardinality controlled) |
| **Logs** | "What exactly happened on this request?" | Structured events | High (sampled / retained per class) |
| **Traces** | "Where did the time / failure go in this request?" | Spans + dependencies | Medium (often sampled) |

You need all three. Each answers questions the others cannot.

### Metrics — what to collect

**Per service, default set**:

- **RED**: Rate (requests/s), Errors (errors/s), Duration (latency histogram).
- **USE**: Utilization (CPU/mem/IO %), Saturation (queue depth), Errors (system-level).

**Per business event**: counter per meaningful product event (`user.invited`, `flow.executed`, `payment.charged`). These drive product metrics + sanity dashboards.

**Cardinality discipline**: metric labels should be low-cardinality. `service` + `method` + `status` is fine. `user_id` as a label is fatal — every user explodes the metric count. Use logs / traces for high-cardinality dimensions.

### Logs — what to log

Structured JSON, not free-form strings:

```ts
logger.info("user.invited", {
  workspaceId,             // multi-tenant attribution
  inviterId,
  inviteeEmail: "<redacted>",  // PII redacted
  requestId,
  durationMs: 47,
});
```

**Required fields on every log**:

- `level` (info / warn / error / debug).
- `tag` (the source component).
- `timestamp` (ISO-8601 UTC).
- `requestId` (correlates with traces).
- `workspaceId` / `tenantId` (multi-tenant attribution).

**What to log** (good signal):

- Boundary crossings (request enters / exits).
- Business events (the named events above).
- Recoverable errors (with `cause`).
- State transitions.

**What NOT to log**:

- Routine per-row reads.
- Inside hot loops.
- Anything with raw PII / secrets — redact at the logger.

### Traces — what to trace

A trace is a tree of spans for one request, across services / async boundaries.

**Span at**:

- Every boundary (HTTP / RPC / IPC).
- Every external call (DB query, third-party API, message-bus publish).
- Significant in-process operations (a long parse, an expensive computation).

**Span attributes**:

- Service + method name.
- Status (ok / error).
- Duration.
- Request-id propagated across boundaries.
- Multi-tenant attribution.

Sampling: 100% of error traces; per-tenant sampling of successful traces (e.g. 1%). Critical paths (payment, security) sampled higher.

### Correlation

The unifying field is `requestId`. Every signal carries it:

- Logs include `requestId`.
- Traces use `requestId` as the trace id.
- Metric exemplars (when supported) link to a representative trace via requestId.

From a single user-reported issue: read the logs by requestId → jump to the trace → see the metric at that time. Five minutes of triage, not an hour.

### SLOs and SLIs

**SLI (Service-Level Indicator)**: a measurable thing. "p95 latency of `users.list`". "Error rate of `payments.charge`".

**SLO (Service-Level Objective)**: a target. "p95 < 200ms over rolling 30 days". "Error rate < 0.1% over rolling 7 days".

**SLA (Service-Level Agreement)**: the contractual version of an SLO with consequences. Usually weaker than internal SLOs (you pad internally).

Pick SLIs per **user journey**, not per service. The user does not care that `users-service` is fast if `auth-service` is slow blocking their login.

Example SLO catalogue:

| Journey | SLI | SLO |
|---|---|---|
| Login | p95 end-to-end latency | < 1s over 30 days |
| Login | success rate | > 99.9% over 7 days |
| Run flow | p95 dispatch latency | < 500ms over 30 days |
| Run flow | success rate (excluding user errors) | > 99.5% over 7 days |
| Page load (dashboard) | p95 TTFB | < 800ms over 30 days |

### Error budget

For each SLO, the **error budget** is what is allowed to fail. 99.9% / 30 days = 43 minutes of badness allowed.

When the error budget burn rate is high (burning a month's budget in a day), alert. When the budget is exhausted, freeze risky changes (feature rollouts, infra migrations) until budget recovers.

Error budget is the framework for negotiating reliability vs feature velocity:

- Budget intact → ship features fast.
- Budget low → focus on reliability.

### Alerting

Alert on **user-impacting** failures, not on every anomaly:

- High burn rate on an SLO (you'll exhaust the budget within hours).
- Cross-cutting saturation (CPU 95% on every node).
- Specific catastrophic events (audit ledger verification failed, vault unreachable, region down).

Anti-alerts (avoid):

- "Error count > 5 in 1 minute" — noise, churn.
- Every individual ERROR log line.
- Every transient latency spike.

Alerts should wake someone. If they would not be actionable at 3 AM, they should not page.

### Dashboards

Per service:

- RED metrics.
- USE metrics.
- Top business events (counts per minute).
- SLO burn-rate.

Per team:

- The SLOs they own.
- Recent incident burndown.
- Top error sources (by count, by user impact).

Per tenant (for support):

- Their request rate, error rate, p95 latency.
- Their quota usage.

### Cost

Observability is expensive. Discipline:

- **Metrics**: low cardinality; aggregate at source where possible.
- **Logs**: structured + sampled; retention tiered (full for 7 days, sampled for 90, cold for 1 year).
- **Traces**: tail-sampled (keep error traces in full; sample success).

Forecast your observability bill alongside your infra bill. Surprise observability costs are common.

### Multi-tenant attribution (mandatory)

Every signal in a multi-tenant system carries the tenant id. Support runs queries scoped to one tenant. Cost attribution per tenant flows from this.

If you cannot attribute a metric / log / trace to a tenant, you cannot:

- Help that specific customer.
- Bill that customer (cost-based pricing).
- Detect noisy-neighbor effects.
- Honour DSAR (delete that tenant's logs).

### Common failure modes

- **High-cardinality metric label.** Time-series DB blows up. → User id in logs/traces, not metric labels.
- **Free-form log messages.** Cannot query. → Structured logs.
- **Alerts on every error.** Pager fatigue; real alert ignored. → Alert on burn rate / impact.
- **No trace correlation.** Request fails; logs are scattered; no causality. → `requestId` everywhere.
- **No SLOs.** "Is the system OK?" answered by feel. → Define + dashboard + alert.
- **Tenant attribution missing.** Cannot help a specific customer. → Mandatory tag on every signal.
- **Observability stack costs as much as the product.** Sampling + retention not tuned. → Tiered retention; sampling.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Metrics | Prometheus, Datadog, Cloudwatch, Grafana Cloud |
| Logs | Loki, Elastic, Datadog, Cloudwatch Logs |
| Traces | OpenTelemetry + Jaeger / Tempo / Datadog APM |
| Dashboards | Grafana, Datadog |
| Alerting | Alertmanager, PagerDuty, Opsgenie |
| Errors / exceptions | Sentry, Rollbar |
| RUM (real-user monitoring) | Datadog RUM, Sentry, NewRelic |

OpenTelemetry as the **instrumentation standard** lets you swap backends.

### See also

- [`universal.md`](/docs/pillars/quality/universal) — gates produce actionable signals; observability extends the principle to runtime.
- [`performance-budgets-pattern.md`](/docs/pillars/quality/performance-budgets-pattern) — perf budgets are derived from observability data.
- [`chaos-engineering-pattern.md`](/docs/pillars/quality/chaos-engineering-pattern) — observability is a precondition.
- [`../security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — distinct from observability (compliance vs operations).
