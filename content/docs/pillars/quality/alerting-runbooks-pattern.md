---
title: 'Alerting + Runbooks Pattern'
description: 'How to turn observability data into a healthy alerting setup — pages that matter, runbooks that work, alert hygiene that prevents pager fatigue.'
---

# Alerting + Runbooks Pattern

How to turn observability data into a healthy alerting setup — pages that matter, runbooks that work, alert hygiene that prevents pager fatigue.

## TL;DR (human)

Alert on **user-impacting** failures, not on every anomaly. Each alert has a runbook with five sections (symptoms / verify / mitigate / diagnose / resolve). Tune alerts on a cadence: aim for > 80% page-worthy ratio. Pager fatigue is the silent killer of on-call quality.

## For agents

### What deserves an alert

A signal becomes an alert when **all** of these hold:

1. **User-impacting** (or will be soon).
2. **Actionable** by the on-call responder.
3. **Recoverable** within minutes-to-hours by a single responder.
4. **Confirmable** (the responder can verify the alert is real).

If any condition fails, it's not an alert:

- Not user-impacting → dashboard / weekly review.
- Not actionable → diagnostic; not paging-worthy.
- Recovery requires team effort → SEV escalation; broader response, not single page.
- Cannot confirm → false-positive risk; tune the signal first.

### Alert types

**Symptom alerts** (preferred): "the user-visible thing is broken".

- p95 latency for journey X > Y for N minutes.
- Error rate for endpoint Z > 1%.
- Synthetic check for golden path failing.

**Cause alerts**: "an underlying thing is failing".

- DB connection pool saturation.
- Disk > 90% full.
- Queue depth growing > rate.

Symptom alerts catch what users see. Cause alerts catch what produces those symptoms.

Both are needed. Symptom alerts as the primary; cause alerts as predictive (catch before the symptom).

### Burn-rate alerting (SLO-based)

Modern best practice: alert on SLO **error budget burn rate**, not on raw thresholds.

```
SLO: 99.9% over 30 days
Error budget: 0.1% = 43.2 minutes of badness
```

Burn rate = current error rate / acceptable error rate.

| Burn rate | Time to exhaust 30-day budget | Page? |
|---|---|---|
| 1× | 30 days | No |
| 2× | 15 days | Maybe — slow burn |
| 14× | 2 days | Yes (high severity) |
| 100× | 7 hours | Yes (critical) |

Multi-window approach (catches both fast and slow burn):

- **Fast window** (5 min): burn rate > 14× over 5 min → critical alert.
- **Slow window** (1 h): burn rate > 1× over 1 h → warning.

This avoids both pager fatigue (slow degradation pages too often) and silent budget exhaustion (slow drift not caught).

### Per-alert anatomy

Every alert config includes:

```yaml
- name: payments-p95-latency-burn-rate
  description: Payment endpoint p95 latency violating SLO
  severity: SEV-1
  query: |
    (rate(http_request_duration_seconds{handler="/api/charge",quantile="0.95"} > 0.5) > ...)
  windows:
    - 5m, threshold 14
    - 1h, threshold 1.5
  runbook: https://runbooks.example.com/payments-latency
  team: payments
  page_at: SEV-1
```

Required fields:

- **Name + description**: human-readable.
- **Severity**: maps to paging policy.
- **Query**: the actual signal.
- **Windows + thresholds**: when to fire.
- **Runbook URL**: link.
- **Team**: routing.

If you can't fill `runbook` URL, the alert isn't ready.

### Runbook structure

Five sections:

```markdown
# Runbook — Payments p95 latency violating SLO

## Symptoms

- Alert: `payments-p95-latency-burn-rate` firing.
- User-visible: checkout slow; customer reports.
- Dashboard: payments p95 dashboard shows red.

## Verify (1 minute)

- Open dashboard: <link>
- Confirm p95 elevation is real (not metric spike).
- Check if related alerts also firing (DB, payment-provider, dependency).

## Mitigate (5 minutes)

- If a recent deploy: roll back (last good revision: `git log origin/main`).
- If a payment provider issue: flip kill-switch to fallback provider (see `flags-pattern.md`).
- If a DB issue: route to replica (see `distributed-data-pattern.md`).

## Diagnose (15 minutes)

- Trace: <link to traces filtered to the slow endpoint>.
- Recent deploys: <link>.
- Provider status: <link to third-party status page>.
- Anomalies: <link to dashboard>.

## Resolve

- If root cause is in our code: ticket; fix in next PR.
- If root cause is provider: comms to customers; track provider's resolution.
- Post-mortem within 5 business days.

## Last reviewed

YYYY-MM-DD by @owner. Next review: quarterly.
```

A runbook last reviewed > 6 months ago is suspect.

### Alert routing

| Severity | Action | Who | Mechanism |
|---|---|---|---|
| SEV-1 | Page primary | On-call primary | PagerDuty / Opsgenie / Splunk On-Call |
| SEV-2 | Page primary | On-call primary | Same; possibly different paging policy |
| SEV-3 | Notify | Team channel | Slack / Teams |
| SEV-4 | Ticket | Backlog | Jira / Linear / GitHub Issues |

Per-team routing: the alert knows which team owns the affected service.

### Alert tuning loop (quarterly)

For every alert in the system, ask:

| Question | Action if "no" |
|---|---|
| Did this fire this quarter? | If never: delete (or document as latent SEV-1 sentinel) |
| Was every fire actionable? | If < 80%: tune threshold / scope |
| Did the runbook help? | If no: rewrite or delete the runbook |
| Did the fire correlate with user impact? | If no: convert to non-paging dashboard |
| Has the underlying alert query changed since last review? | If yes: re-validate threshold |

Track:

- **Page-worthy ratio** per alert (actionable fires / total fires).
- **MTTA** (mean time to acknowledge) per alert.
- **Pages per shift** (target: < 2 per week per responder; ≤ 0 ideal).

### Alert fatigue — the cycle

Too many alerts → responders ignore → real alert missed → outage → more alerts added → fatigue worsens.

Symptoms:

- Pages auto-acknowledged without reading.
- "I'll look at it after my coffee" responses.
- New team members ignored on first pages.
- Outages where the alert was present but ignored.

Recovery:

- Delete more aggressively than you add.
- Audit alerts quarterly with the team that gets paged by them.
- Move medium-signal alerts to dashboards.

### Synthetic checks

For golden paths (login, checkout, primary-feature-X):

- Synthetic check from outside the system, every minute (or 5 min).
- Multi-region (catches geo-localised failure).
- End-to-end (not just "ping returns 200").
- Alert on N consecutive failures (avoid single-shot false positives).

Synthetic checks catch what internal metrics miss — network-edge issues, DNS, CDN, third-party-provider-down.

### Service health page

Per service:

- Currently-firing alerts.
- Recent incidents.
- SLO burn rates.
- Recent deploys.
- Owning team + on-call contact.

A single URL per service that answers "is this service okay?" without expertise.

### Alert dependencies

Some alerts depend on others. The classic trap:

- Service A's alert fires.
- Service B (which depends on A) also alerts; redundant.
- Service C (which depends on B) also alerts; double-redundant.
- One incident → 7 pages.

Mitigations:

- **Alert grouping**: cluster related alerts into one notification.
- **Dependency-aware suppression**: if A is firing, suppress dependents until A resolves.
- **One service of record**: only the leaf service's alert pages; uphill services log but don't page.

### Alert blast-radius

When an alert fires, what's the radius?

- One service → service team paged.
- Multi-service → cross-team incident; escalate to IMOC (see [`../security/on-call-rotation-pattern.md`](../security/on-call-rotation-pattern.md)).
- Whole system → SEV-1; full incident response.

Routing logic accounts for radius:

- Single-service alert → team page.
- Multi-service correlation → IMOC page.
- Auth / billing / audit failure → security team + IMOC.

### Pre-alert: dashboards + logs

Not every signal alerts. Three tiers:

1. **Pages**: the small set that pages someone.
2. **Dashboards**: visible during business hours; reviewed weekly.
3. **Logs / traces**: queryable on demand; not surfaced unless investigated.

The split avoids both fatigue (everything pages) and silent drift (nothing surfaces).

### Common failure modes

- **Alert on every error**. Pager fatigue. → Symptom alerts; SLO burn rates.
- **No runbook**. Responder guesses. → Mandatory runbook URL on every alert.
- **Runbook says "see logs"**. Useless. → Specific queries, links, commands.
- **Alert fires for stale reasons**. Half the team ignores; new joiners don't. → Quarterly tune.
- **No synthetic checks**. Real users feel outage before metrics. → Synthetic for golden paths.
- **Per-host alerts in cattle-not-pets infra**. One pod restart = page. → Aggregate; alert on the abnormal rate, not individual.
- **No grouping**. One incident = 20 pages. → Group; suppress dependents.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Alert engine | Alertmanager (Prometheus), Grafana Alerting, native cloud (CloudWatch, GCP Monitoring) |
| Paging | PagerDuty, Opsgenie, Splunk On-Call, VictorOps |
| Synthetic checks | Datadog Synthetics, Pingdom, Checkly, native cloud |
| Dashboards | Grafana, Datadog, native cloud |
| SLO management | Sloth (Prometheus SLO generator), Datadog SLOs, in-house |
| Runbooks | Confluence, repo-committed markdown, FireHydrant, Jeli |
| Incident tracking | FireHydrant, Jeli, Incident.io |

### See also

- [`observability-pattern.md`](./observability-pattern.md) — the data; alerts read from it.
- [`../security/on-call-rotation-pattern.md`](../security/on-call-rotation-pattern.md) — rotation that responds to pages.
- [`chaos-engineering-pattern.md`](./chaos-engineering-pattern.md) — drills test runbooks.
- [`../security/secrets-leak-postmortem-playbook.md`](../security/secrets-leak-postmortem-playbook.md) — runbook example.
