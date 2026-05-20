---
title: 'Performance Budgets Pattern'
description: 'How to keep ''it''s fast enough'' from drifting into ''why is it slow?'''
---

# Performance Budgets Pattern

How to keep "it's fast enough" from drifting into "why is it slow?"

## TL;DR (human)

Performance is a budget, not an afterthought. Three classes of budget: **bundle** (bytes shipped), **latency** (p50 / p95 / p99 per surface), **resource** (queries, allocations, cache hits). Each has a target + a regression gate. Performance work happens on the SLOs that move the needle, not on micro-optimisations that flatter benchmarks.

## For agents

### Three budget classes

| Class | Examples | Where measured |
|---|---|---|
| **Bundle size** | JS bundle per route, total page weight, image weight | Build time |
| **Latency** | p50 / p95 / p99 for HTTP, RPC, DB queries | Production (per [`observability-pattern.md`](./observability-pattern.md)) |
| **Resource** | Queries per request, allocations per request, cache hit rate | Production + load tests |

Each has a target. Each has a regression detector.

### Bundle size budgets

For web apps, per-route budgets:

- **JS** (gzipped): home page ≤ 100 KB; authenticated app shell ≤ 300 KB; per-route lazy chunks ≤ 50 KB.
- **CSS** (gzipped): per page ≤ 30 KB.
- **Images**: hero images ≤ 100 KB; thumbnails ≤ 10 KB; consider WebP / AVIF.
- **Fonts**: subset; max 2 weights × 1 family; preload critical.
- **Total page weight**: ≤ 1 MB above the fold.

Gates:

- Per-route bundle size measured at build (`size-limit`, `bundlewatch`, framework-native budgets).
- CI fails if any route exceeds budget.
- Shrink-only baseline for established codebases.

Recipe: route-level code splitting; dynamic imports for non-critical features; tree-shaking; dead-code elimination.

### Latency budgets

Per user-facing surface:

| Surface | p95 latency budget |
|---|---|
| Auth (login flow) | < 500 ms |
| Dashboard initial load | < 1 s |
| Standard list-fetch | < 300 ms |
| Write (form submit) | < 500 ms |
| Search (interactive) | < 200 ms |
| Background dispatch (start a job) | < 1 s |
| Long-running job (the dispatch, not the work) | < 200 ms |

Budgets vary by product; calibrate based on user research + competitor benchmarks.

Per-tier breakdown (the budget allocated across layers):

```
Total p95 1000ms budget
├── DNS + TLS + connection:    100 ms (CDN / edge)
├── Server processing:         400 ms (handler + queries)
├── Response payload + transit:200 ms (size + network)
└── Browser parse + render:    300 ms (HTML, JS, CSS, paint)
```

Budgets at each layer compose. Blowing the budget at one layer requires shrinking another.

### Resource budgets

**Per request**:

- DB queries: ≤ 10 per request (N+1 detection: > 20 queries = probable N+1).
- DB query time: ≤ 100 ms aggregate per request.
- Cache hit rate (when caching is in play): > 80% in steady state.
- Allocations: track if memory pressure; flag specific endpoints with high allocation rate.

**Per worker / job**:

- Memory: < 75% of provisioned limit in steady state (room for spikes).
- CPU: < 70% in steady state.

### Where the budget enforcement lives

**Build time**: bundle-size gate. Hard fail.

**CI integration test**: query-count gate per endpoint. Synthetic load tests on staging produce p95 measurements. Fail PR if a measured endpoint regressed > 10%.

**Production observability**: SLO burn rate on latency budgets (per `observability-pattern.md`). Alert when budget burns faster than expected.

### Anti-patterns to detect

| Pattern | Signal |
|---|---|
| N+1 query | Per-request query count linearly tied to result count |
| Synchronous fanout to N services | p95 increases with N |
| Hot loop with allocation | GC pressure spikes per request |
| Unbounded result set | Latency increases over time as data grows |
| Missing index | DB CPU climbs; specific query slow |
| Synchronous external call | Tail latency dominated by third-party |
| Render-blocking JS | First Contentful Paint > 2s |
| Large image not lazy-loaded | Above-fold image stalls render |

Each has a recipe to fix; agents can match symptom to recipe.

### Performance work prioritisation

Not all performance issues are worth fixing. Prioritise by:

1. **User impact**: how many users hit it; how often?
2. **Budget burn**: is the SLO at risk?
3. **Cost**: is the slow path also expensive (queries, compute)?

Anti-prioritisation: optimising a path that runs once per week to save 5 ms is noise. Optimising the dashboard load that every user hits 100×/day is high-value.

### Load testing

Synthetic load tests, run periodically:

- **Soak tests**: steady load for hours; surfaces memory leaks, connection-pool exhaustion, cache eviction.
- **Spike tests**: sudden 10× load; surfaces rate-limit gaps, queue-depth blow-ups.
- **Ramp tests**: gradual climb; surfaces the point where p95 explodes.

Tools: k6, Vegeta, Locust, Gatling.

Load tests run against staging with production-like data shapes. CI-integrated tests for critical paths; longer tests pre-release.

### Real-user monitoring (RUM)

Production gives the truth synthetic tests cannot:

- Per-user p50/p95/p99 latency.
- Geographic breakdown.
- Device breakdown (mobile / desktop / connection class).
- Per-route Core Web Vitals (LCP, INP, CLS).

RUM data feeds SLO calculation. Synthetic load tests catch what RUM will reveal; RUM catches what synthetic missed.

### Performance as a feature

Communicating performance to users:

- Optimistic UI: render the new state immediately; reconcile after.
- Skeleton loading: shows structure within 100ms (per [`../ui-ux/universal.md`](../ui-ux/universal.md) Rule 4).
- Streaming results: don't wait for the full payload to render.
- Background work + progress: tell the user it is happening; estimate completion.

Perceived performance > measured performance. A 2-second operation that feels instant beats a 1-second operation that feels slow.

### Common failure modes

- **No budget at all.** "It's fast enough." Until it isn't. → Document budgets; gate regressions.
- **Budgets that no one reviews.** Budget creeps; nobody notices. → Budget review at release time.
- **Micro-optimisations that don't move the needle.** Optimised a 5 ms function nobody hits. → Measure user-perceived; prioritise by impact.
- **Bundle-size gate without per-route detail.** Total goes up by 2 KB; you don't know which route. → Per-route budgets.
- **Synthetic-only measurement.** Tests say fast; users say slow. → RUM mandatory; sample real users.
- **Performance work that breaks tests.** Speed at expense of correctness. → Performance budget is part of the contract; correctness is not negotiable.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Bundle analyzer | webpack-bundle-analyzer, source-map-explorer, `next bundle` |
| Bundle gate | size-limit, bundlewatch, framework-native |
| Synthetic load | k6, Vegeta, Locust |
| RUM | Sentry, Datadog RUM, NewRelic Browser, CrUX |
| Profiling (server) | clinic.js, perf, py-spy, async-profiler (Java) |
| Profiling (web) | Chrome DevTools Performance, React Profiler |
| Core Web Vitals | Lighthouse CI, web-vitals lib |

### See also

- [`observability-pattern.md`](./observability-pattern.md) — measurement infrastructure.
- [`../architecture/anti-overengineering.md`](../architecture/anti-overengineering.md) — premature optimisation reminder.
- [`../architecture/distributed-data-pattern.md`](../architecture/distributed-data-pattern.md) — caching tiers; replica routing.
- [`chaos-engineering-pattern.md`](./chaos-engineering-pattern.md) — load tests + fault injection.
