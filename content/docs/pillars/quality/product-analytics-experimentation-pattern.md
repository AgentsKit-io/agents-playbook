---
type: Playbook Pattern
title: 'Product Analytics + Experimentation Pattern'
description: 'How to measure what users do, run experiments cleanly, and let data drive product decisions — without inviting bias or noise.'
---

# Product Analytics + Experimentation Pattern

How to measure what users do, run experiments cleanly, and let data drive product decisions — without inviting bias or noise.

## TL;DR (human)

Product analytics is distinct from observability (system health). Two surfaces: **event tracking** (what users do) + **experiments** (controlled tests of variants). Discipline: a tracking schema; consent + privacy; pre-registered hypotheses; minimum sample size; honest stop conditions. Avoid HARKing (hypothesizing after results known) and p-hacking.

## For agents

### Analytics vs observability

| Dimension | Observability | Product analytics |
|---|---|---|
| Question | Is the system healthy? | What are users doing? |
| Audience | Engineers, on-call | Product, growth, leadership |
| Signal | Metrics, logs, traces | Events, funnels, cohorts |
| Tooling | Prometheus, Datadog, OTel | Mixpanel, Amplitude, PostHog, Segment |
| Cardinality | Low (per service) | High (per user, per event) |

Different needs, different storage, different teams. Don't conflate.

### Event tracking schema

Every tracked event has:

```ts
type AnalyticsEvent = {
  name: string;                // "flow.run.started"
  timestamp: string;
  userId?: string;             // anonymized if consent not granted
  workspaceId?: string;
  sessionId: string;
  properties: Record<string, unknown>;
  context: { userAgent, referrer, locale, ... };
};
```

Naming convention: `\<surface\>.\<action\>.\<state\>` — `flow.run.started`, `checkout.coupon.applied`, `dashboard.tab.opened`.

Schema discipline:

- Events registered in a central registry (typed; reviewed).
- Per-event properties documented.
- Renames go through the same deprecation as APIs.
- Avoid `event_type=foo, value=bar` pattern; use specific event names.

### Consent + privacy

Per [`../security/data-classification-pattern.md`](/docs/pillars/security/data-classification-pattern):

- Tracking pixels / analytics SDK loaded only after consent (EU) or with opt-out availability (CA).
- PII never in event properties (no emails, names, raw IPs).
- User ID → hash; reversible only with explicit privilege.
- DSAR deletion: walks analytics data too.
- Cookie banner respects user choice; doesn't dark-pattern.

### Funnels and cohorts

Funnel: ordered sequence of events. Measures drop-off.

```
signup.started → signup.email-entered → signup.verified → signup.completed
```

Cohort: group of users sharing an attribute or behavior. Measures retention.

```
"users who completed signup in week N" — track week-N+1, N+2, ... retention.
```

These are the workhorses. Most product metrics come from one or the other.

### Experiments — A/B + multivariate

An experiment varies one or more dimensions across user segments; measures impact.

**Pre-register**:

- Hypothesis: "Reducing form fields from 5 to 3 will increase signup conversion."
- Primary metric: signup conversion rate.
- Guardrail metrics: completion-of-key-action 7 days later (don't optimise top-of-funnel at the cost of long-term value).
- Sample size: how many users per variant for statistical significance.
- Duration: how long; minimum 1 week for weekday/weekend effects.
- Stop conditions.

**Run**:

- Assign users to variants deterministically (hash of user-id mod N).
- Sticky: same user sees same variant across sessions.
- One experiment per metric per surface at a time (parallel experiments confound).
- Don't peek + stop early without sequential analysis methods (avoid p-hacking).

**Analyze**:

- Compute primary + guardrail metrics.
- Statistical significance test (frequentist or Bayesian).
- Check for sample bias.
- Document outcome.

**Decide**:

- Win → promote.
- Loss → kill.
- Inconclusive → either more data or kill.

### Sample size + power

A common mistake: running underpowered experiments.

Minimum detectable effect (MDE) and required sample size are inversely related. For a 1% absolute conversion lift on a 5% baseline, typically ~30,000 users per variant for 80% power.

Tools: built-in calculators in analytics platforms; G*Power; in-house pre-flight checks.

If you can't get the sample size in a reasonable window: pick a more sensitive metric or larger MDE.

### Statistical anti-patterns

| Pattern | Why wrong | Fix |
|---|---|---|
| **Peeking + stop early** | Inflates false positive rate | Sequential / Bayesian methods; or commit to duration |
| **HARKing** (hypothesise after seeing results) | Confirms noise | Pre-register hypothesis |
| **p-hacking** (run many metrics; one happens to be significant) | Multiple comparisons; false discovery | Limit metrics; correct for multiple tests |
| **Subgroup hunting** | Same as p-hacking | Pre-registered subgroups only |
| **Ignoring guardrail metrics** | Optimise locally, lose globally | Always include long-term + counter-balance |
| **Stopping at "no significant difference"** | Absence of evidence isn't evidence of absence | Power analysis; effect-size bounds |

### Holdout groups

Beyond per-experiment, maintain holdout cohorts:

- 1-5% of users never see any experiments.
- Lets you measure cumulative impact of all changes.
- Catches regressions invisible at experiment-by-experiment level.

### Experiment retirement

Like feature flags (per [`../architecture/feature-flags-pattern.md`](/docs/pillars/architecture/feature-flags-pattern)):

- Mandatory `retireAt`.
- Decision recorded + variant cleaned up.
- Loser variant code deleted.

### North-star metric

One metric that captures product success:

- DAU / MAU for social products.
- ARR for subscription products.
- Net retention for SaaS.
- Hours of value delivered (custom).

Sub-metrics ladder up. Engineering OKRs tie to north-star.

### Privacy + analytics — staying clean

- Use anonymized identifiers per user (rotating, salted).
- Aggregate before storing where possible (counts, not individuals).
- Server-side tracking preferred over client (less ad-block; more reliable).
- Self-hosted analytics if data must stay in-house.
- DSAR-able: analytics rows tagged with user-id-hash; deletion walks them.

### Common failure modes

- **Inconsistent event naming**. Half use snake_case, half camelCase; analyses break. → Registry.
- **PII in event properties**. Email as user-id. → Schema review.
- **Experiments without pre-registration**. HARK + p-hack rampant. → Pre-register; tool enforces.
- **No holdout group**. Local wins; global loss invisible. → Holdouts.
- **Tracking after consent withdrawn**. GDPR violation. → SDK respects consent state.
- **Experiment retired by removing the loser inline + leaving flag**. Stale flag. → Full retirement.
- **Vanity metrics**. Page views; bounce. Not tied to value. → Focus on activation, retention, revenue.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Event tracking | Mixpanel, Amplitude, PostHog, Heap, Segment |
| Server-side | Segment, Snowplow, RudderStack, in-house |
| Experimentation | Statsig, GrowthBook, Optimizely, LaunchDarkly Experiments, in-house |
| Data warehouse | Snowflake, BigQuery, Redshift, ClickHouse |
| BI | Looker, Tableau, Metabase, Mode |
| Funnel + cohort | Built into Mixpanel/Amplitude; or warehouse-native |

### Adoption path

1. **Day 0**: a small event schema (10-20 events covering signup + activation + core actions); consent banner; SDK.
2. **Month 1**: funnels for primary user journeys.
3. **Month 2**: cohort retention dashboards.
4. **Month 3**: first experiment; statistically rigorous.
5. **Month 6**: holdout group; experiment platform.
6. **Year 1+**: north-star + sub-metrics ladder; experimentation as product practice.

### See also

- [`observability-pattern.md`](/docs/pillars/quality/observability-pattern) — observability, distinct from analytics.
- [`../architecture/feature-flags-pattern.md`](/docs/pillars/architecture/feature-flags-pattern) — experiments as flags.
- [`../security/data-classification-pattern.md`](/docs/pillars/security/data-classification-pattern) — privacy classifications.
- [`../security/compliance-framework-pattern.md`](/docs/pillars/security/compliance-framework-pattern) — GDPR / CCPA implications.
