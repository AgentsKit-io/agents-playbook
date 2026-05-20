---
title: 'Caching + CDN Pattern'
description: 'How to layer caches so the system is fast, cheap, and consistent — three properties at tension.'
---

# Caching + CDN Pattern

How to layer caches so the system is fast, cheap, and consistent — three properties at tension.

## TL;DR (human)

Three cache tiers: in-process, distributed, CDN/edge. Each has different latency, hit-rate, and invalidation profile. Cache invalidation is the second-hardest problem; default to TTL backstops on everything. Cache keys must scope by tenant; cache busting requires a strategy designed before the first cache lands.

## For agents

### The three tiers

| Tier | Latency | Hit rate | Invalidation difficulty |
|---|---|---|---|
| **In-process** (memory, per-process) | sub-µs | High per worker; low across cluster | Easy (process restart) |
| **Distributed** (Redis, Memcached, Hazelcast) | sub-ms (in-region) | Cross-process; cluster-wide | Medium |
| **CDN / edge** (Cloudflare, Fastly, Akamai, CloudFront) | ms globally | Geographically distributed | Hard |

A typical product uses all three: in-process for tiny hot objects, distributed for shared reads, CDN for public assets + cacheable HTML.

### Cache invalidation strategies

| Strategy | When to use |
|---|---|
| **TTL only** | Eventually-consistent data; simplest; safe default |
| **Write-through** | Cache updated on every write |
| **Write-around** | Writes skip cache; reads fetch + cache |
| **Write-back** | Cache absorbs writes; flushed async (rare; risk of loss) |
| **Event-based** | On write, publish invalidate event; consumers evict |
| **Versioned keys** | Cache key includes entity version; new version = new key |
| **Stale-while-revalidate** | Serve stale; refresh in background |

Versioned keys are surprisingly powerful — no invalidation needed; updates just produce new keys.

### TTL discipline

Every cache entry has a TTL. No exceptions. Even with event-based invalidation, TTL is the backstop — if the event is lost, the cache self-heals within the window.

Per data class:

- Hot public data (no user-specific): seconds to minutes.
- Per-tenant cacheable: minutes.
- Per-user session: minutes to hours.
- Public static assets: long (days to year) + cache-busting via versioned URL.

### Cache key discipline

Multi-tenant: every cache key includes tenant id:

```
cache:workspaces:<workspaceId>:user:<userId>
cache:flows:<workspaceId>:list:v3:limit=20:cursor=abc
```

A key without tenant scope is a data-leak waiting to happen. Lint scans for cache calls in code without a tenant identifier.

Key naming:

- `cache:\<entity\>:\<scope\>:\<id\>:\<purpose\>`.
- Include version in key (`v3`) to roll-forward without flushes.
- Hash long composite keys; keep short prefix for debugging.

### Cache stampede protection

When a hot key expires, N concurrent requests hit the origin. Mitigations:

- **Probabilistic early refresh**: a small percentage of requests refresh proactively before expiry.
- **Lock + single-flight**: only one request fetches; others wait.
- **Stale-while-revalidate**: serve stale; refresh background.

Default: stale-while-revalidate. Simple; effective.

### CDN tier

CDN handles:

- Public static assets (JS, CSS, fonts, images). Long TTL + content-hashed URL.
- Public HTML / API responses (per `Cache-Control` headers).
- Geographic distribution: edge POPs close to users.
- DDoS absorption (large CDNs have multi-Tbps capacity).

Configuration:

- `Cache-Control: public, max-age=31536000, immutable` for content-hashed assets.
- `Cache-Control: private` for user-specific.
- `Cache-Control: no-store` for sensitive (auth tokens, PII).
- `Vary` header for content negotiation.

Edge invalidation:

- Purge API per CDN; typically slow (minutes propagation).
- URL purge: invalidate one path.
- Tag purge: invalidate all URLs tagged X (when CDN supports).
- Default: design URLs to NOT need invalidation (content-hashed).

### Browser cache

Often forgotten:

- Service worker (PWA) is a cache too.
- HTTP cache (browser).
- Memory cache (same session).

Headers control. `immutable` + content-hashed URL eliminates revalidation entirely.

### When NOT to cache

- Per-request authorization-dependent data (cache key must include the auth context exactly).
- Tiny operations (cache lookup itself costs ~µs; uncached is cheaper).
- Data that mutates per request (counters, rate-limit windows).
- Sensitive PII or secrets.

### Cache hit-rate as a metric

Per cache:

- Hit rate (target: > 60% steady; varies).
- Miss penalty (origin latency).
- Eviction rate (high = too small or churn).

Track. Alert if hit rate drops; signals key churn, app pattern change, or capacity issue.

### Common failure modes

- **Cache key without tenant**: cross-tenant data leak.
- **No TTL**: stale forever.
- **Event-based invalidation, no TTL backstop**: missed event = forever stale.
- **Cache stampede**: hot key expires; thunder herd hits origin.
- **Caching authorized content publicly**: served to wrong users.
- **Aggressive CDN cache on dynamic page**: users see other users' state.
- **In-process cache in multi-replica deploy**: stale per replica; user gets different state each request.

### See also

- [`distributed-data-pattern.md`](./distributed-data-pattern.md) — read-replica + cache interplay.
- [`../security/multi-tenant-isolation-pattern.md`](../security/multi-tenant-isolation-pattern.md) — cache scope.
- [`../quality/cost-optimization-pattern.md`](../quality/cost-optimization-pattern.md) — cache hit rate as cost metric.
- [`../quality/performance-budgets-pattern.md`](../quality/performance-budgets-pattern.md) — cache pays the budget.
