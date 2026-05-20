# Rate Limiting + DDoS Protection Pattern

How to absorb traffic spikes — both benign (popular feature) and malicious (DDoS / abuse) — without breaking for legitimate users.

## TL;DR (human)

Multi-layer defense: edge (CDN / WAF) absorbs L3/L4 + bulk L7; per-route rate limits stop per-user abuse; per-tenant quotas stop noisy-neighbor. Different limits for unauth vs auth, for sensitive routes (login, signup, reset). Tokens-bucket / sliding-window algorithms; consistent across services via shared store.

## For agents

### Defense layers

| Layer | Defends against | Tool |
|---|---|---|
| **L3/L4 (network)** | Volumetric attacks (SYN flood, UDP flood) | Cloud provider's DDoS service (CloudFront, Cloudflare, AWS Shield) |
| **L7 (HTTP) — bulk** | High-volume HTTP floods | WAF + CDN rate limit (Cloudflare, Akamai) |
| **Per-route rate limit** | Per-user / per-IP abuse | Application middleware (Redis-backed) |
| **Per-tenant quota** | Noisy neighbor | Application logic (per [`multi-tenant-isolation-pattern.md`](./multi-tenant-isolation-pattern.md)) |
| **Backend circuit breakers** | Cascading failure | Library (Polly, resilience4j) |

Edge absorbs volume cheaply. Application layer handles per-identity logic. Both required.

### Rate-limit algorithms

| Algorithm | Mechanic | Pros | Cons |
|---|---|---|---|
| **Fixed window** | Counter per N seconds | Simple | Burst at window boundary |
| **Sliding log** | Timestamps; remove old | Accurate | Memory cost; slow |
| **Sliding window counter** | Two windows; weighted | Good balance | Approximation |
| **Token bucket** | Refill rate + bucket size | Bursty allowed; smooth steady | Tunable |
| **Leaky bucket** | Constant drain rate | Smooths bursts | No burst allowed |

Default: **token bucket** for user-facing; **leaky bucket** for cost-sensitive (downstream-rate-limited).

### Configuration discipline

Per route, per identity class, set:

- **Rate**: requests per time window.
- **Burst**: short-term excess allowed.
- **Identity**: by IP, user, tenant, API key.

Examples:

```
GET /api/users/me:
  per-user: 60/min; burst 10
  per-ip (unauth): 100/min; burst 20

POST /auth/login:
  per-ip: 5/min; burst 0  ← anti-credential-stuffing
  per-username: 5/min     ← anti-targeted-attack

POST /api/llm/complete:
  per-tenant: 100/min (free), 1000/min (pro), 10000/min (enterprise)
  per-user: 30/min
```

Sensitive routes (login, signup, password reset, OTP, payments) get tighter limits.

### Per-identity choice

| Identity | Use when |
|---|---|
| **User id (auth)** | Default for authenticated routes |
| **API key** | Programmatic access |
| **Tenant id** | Multi-tenant; aggregate across tenant's users |
| **IP address** | Unauth + signup + login |
| **Session id** | Pre-auth flows |

Combine: a route may have multiple limits (per-user + per-tenant + per-IP); the strictest fires.

IP-only is fragile (NAT, shared corporate networks). Use IP + something else where possible.

### Response when limit exceeded

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000000

{ "code": "RATE_LIMITED", "message": "...", "hint": "Try again in 30 seconds." }
```

`Retry-After` is honored by good clients; tells them when to retry. Returns `code: "RATE_LIMITED"` for app-level handling.

### Shared store

Per-instance rate limits don't work in horizontal-scale environments. A user hitting different replicas would bypass.

Use a shared store:

- **Redis** with atomic ops (INCR + EXPIRE; or Lua scripts for sliding window).
- **DynamoDB** with conditional writes.
- **Memcached** (less common; eviction can break rate limits).

Cost: one Redis hop per request. Mitigate via:

- Lazy refill (compute bucket on-demand rather than per-request).
- Local approximation + periodic sync.

### Login + signup specifics

Specific patterns for abuse-prone endpoints:

**Login**:

- Per-IP rate: 5-10/min.
- Per-username rate: 5/min (catches credential stuffing against specific accounts).
- Per-failed-attempt backoff: exponential.
- After N failures: CAPTCHA challenge or temp lockout.
- Notify user on multiple failed attempts.

**Signup**:

- Per-IP rate: 3-5/min.
- Email verification mandatory (no instant access).
- Phone verification for higher-risk products.
- Abuse signals (disposable email domain, VPN/Tor, signup pattern) → manual review queue.

**Password reset**:

- Per-email rate: 3/hour.
- Per-IP rate: 10/hour.
- Never confirm whether email exists (avoid enumeration).
- Tokens single-use; short-lived (10-30 min); IP-bound where viable.

### WAF + bot protection

A managed WAF (Cloudflare, AWS WAF, Akamai) provides:

- Geo blocking (when needed).
- Bot detection (signal-based; not perfect).
- Managed rule sets (OWASP top 10 patterns).
- Bot challenge (CAPTCHA on suspicion).
- IP reputation lists.

Configure to block / challenge:

- Suspicious user-agents.
- Known bad IP lists.
- Geographic restrictions (per business needs).

Avoid: blocking entire countries by default — legitimate users get blocked. Geo restrict only when business reason.

### CAPTCHA / challenge

When abuse detected, escalate before block:

- **Invisible challenge** (Cloudflare Turnstile, hCaptcha, reCAPTCHA v3): scoring; transparent to good users.
- **Visible challenge**: image puzzle; user friction.
- **Magic link / 2FA**: highest friction; for verified compromise scenarios.

Friction sequence: invisible → visible → block. Match severity.

### Backend circuit breakers

When an upstream is failing, fail fast rather than pile up requests:

- After N consecutive failures: open circuit; immediate failure for all requests.
- After cool-down: half-open; try one request; reset on success.

Avoids:

- Thundering herd on recovery.
- Cascading failure (your service can't catch up; the next one chokes).

Libraries: Polly (.NET), resilience4j (JVM), opossum (Node).

### Per-tenant abuse signals

Beyond limits, detect:

- One tenant generating > Nx the median request rate.
- One tenant's error rate suddenly spikes (broken integration).
- One tenant accessing many distinct resources rapidly (scraping signal).
- Unusual times / patterns (per [`../quality/observability-pattern.md`](../quality/observability-pattern.md)).

Each surfaces in a dashboard; on-call has a runbook for "noisy tenant".

### Costs

DDoS protection isn't free:

- CDN traffic for legit users is the bulk; DDoS spike usually doesn't change much for the CDN.
- WAF rule evaluation adds latency (sub-ms typically).
- AWS Shield Advanced / Cloudflare Enterprise: tens of K USD / year for full protection.

For most products, the managed-CDN's default DDoS protection is enough. Advanced tier when you're a high-value target.

### Common failure modes

- **No rate limit on login**. Credential stuffing succeeds. → Per-IP + per-username.
- **Rate limit per-instance**. Bypassed by hitting different replicas. → Shared store.
- **Rate limit returns 200 with empty body**. Clients retry; defeat purpose. → 429 + Retry-After.
- **No backend circuit breaker**. Upstream goes down; your service piles up; goes down too. → Library.
- **CAPTCHA on every login**. Friction kills good users. → Scoring; only when suspicious.
- **Geo-block based on bad data**. Real users blocked. → Geographic restrictions narrowly + via human decision.
- **Per-IP limits don't account for NAT**. A small office blocked because shared IP. → IP + identity hybrid.
- **No alerting on rate-limit fires**. Abuse goes unnoticed. → Per-route monitoring; spike alerts.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| CDN + edge WAF | Cloudflare, Fastly, Akamai, AWS CloudFront + WAF |
| DDoS L3/L4 | Cloud provider native + AWS Shield Advanced |
| Application rate-limit | express-rate-limit (Node), Flask-Limiter, ASP.NET Core RateLimiting, rate-limiter-flexible |
| CAPTCHA | Cloudflare Turnstile, hCaptcha, reCAPTCHA |
| Bot detection | DataDome, PerimeterX, Cloudflare Bot Management |
| Circuit breaker | Polly, resilience4j, opossum |
| Shared store | Redis, DynamoDB |

### See also

- [`multi-tenant-isolation-pattern.md`](./multi-tenant-isolation-pattern.md) — per-tenant quotas.
- [`session-mgmt-pattern.md`](./session-mgmt-pattern.md) — login-specific limits.
- [`audit-ledger-pattern.md`](./audit-ledger-pattern.md) — rate-limit fires logged.
- [`../architecture/caching-cdn-pattern.md`](../architecture/caching-cdn-pattern.md) — CDN is the absorption layer.
- [`../quality/observability-pattern.md`](../quality/observability-pattern.md) — rate-limit metrics.
