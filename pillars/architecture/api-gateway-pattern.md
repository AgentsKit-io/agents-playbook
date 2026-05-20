# API Gateway Pattern

The edge between clients and your services — what belongs there, what doesn't, and how to keep it from becoming a monolith in disguise.

## TL;DR (human)

An API gateway is the single ingress point: TLS termination, auth verification, rate limiting, routing, observability. It should be **thin** — cross-cutting concerns only; never business logic. Fat gateways become bottlenecks and deploy risks. Common patterns: BFF (Backend-for-Frontend), GraphQL federation, reverse-proxy router.

## For agents

### What belongs in the gateway

| Concern | At gateway |
|---|---|
| TLS termination | ✓ |
| Request routing (host / path) | ✓ |
| Auth token verification (cheap path) | ✓ (deeper auth = service-level) |
| Rate limiting (per IP / per identity) | ✓ |
| Request / response logging | ✓ (sampled) |
| Trace propagation (request-id) | ✓ |
| Compression (gzip / brotli) | ✓ |
| Static asset serving | ✓ (or CDN) |
| Header normalisation | ✓ |
| CORS | ✓ |
| Bot detection | ✓ |
| Geo restrictions | ✓ |
| Request transformation (rare) | Maybe |
| Response caching (rare) | Maybe |
| Business logic | ✗ |
| Database queries | ✗ |
| Cross-service orchestration | ✗ |

### What does NOT belong

- **Business validation**: each service validates its own inputs (per [`contracts-zod-pattern.md`](./contracts-zod-pattern.md)).
- **Service-specific transforms**: that's the service's job; gateway should be generic.
- **Cross-service orchestration**: separate orchestration service; not gateway.
- **Data fetching**: gateway passes through; services own data.

Symptoms of a fat gateway:

- Gateway codebase larger than any backend service.
- Gateway requires expert team to modify.
- Gateway deploys gate other deploys.
- Gateway is a single point of failure with no quick replacement path.

If your gateway has these symptoms, it's eaten responsibilities. Trim.

### Architectures

**Reverse-proxy router** (thinnest): pure routing + cross-cutting:

```
client → ALB / NGINX / Envoy → service A
                              → service B
                              → service C
```

Services own their own auth, validation, business logic. Gateway adds little but routing and cross-cutting.

**BFF (Backend-for-Frontend)**: one gateway-ish service per client type:

```
web client → BFF-web → (services)
mobile     → BFF-mob → (services)
admin      → BFF-adm → (services)
```

BFF tailors API shape per client; reduces per-client over-fetch. Avoids "the API tries to please everyone".

**GraphQL gateway / federation**: GraphQL endpoint composes subgraphs:

```
client → GraphQL gateway → user-service (User subgraph)
                          → flow-service (Flow subgraph)
                          → audit-service (Audit subgraph)
```

Federation (Apollo Federation, Hot Chocolate Federation): subgraphs declare their types; gateway stitches.

**API mesh** (less common): pure proxy with declarative composition rules; no code.

### Choosing

| Pattern | Use when |
|---|---|
| Reverse-proxy | < 10 services; simple shape |
| BFF | Multiple client types with distinct API needs |
| GraphQL | Rich data graph; many clients; query flexibility valued |
| Mesh | Lots of services + standard composition; less common |

### Authentication at the gateway

The gateway verifies tokens (cheap path): signature check, expiry, basic shape.

Deeper auth (per-resource access, capability checks) happens at the service layer (per [`../security/rbac-pattern.md`](../security/rbac-pattern.md)). Gateway sends the verified principal-id; service makes finer decisions.

Why split:

- Gateway can stay generic + fast.
- Services know their own resources + permissions; centralised would couple too tightly.

### Request-id + tracing

Gateway:

- Generates `requestId` (UUID/v7 or ULID) if missing.
- Adds `X-Request-Id` header on outgoing request to services.
- Creates the root trace span.
- Logs the request with id.

Services propagate. Observability correlates (per [`../quality/observability-pattern.md`](../quality/observability-pattern.md)).

### Versioning at the gateway

If versioned URLs (`/v1/...`, `/v2/...`):

- Gateway routes by version.
- Both versions live during deprecation.
- Gateway can run a transformation if v1 → v2 is mechanical (rare; usually the service version owns it).

### Caching at the gateway

For cacheable responses:

- Honor `Cache-Control` from services.
- Tag-based purge.
- Per-user cache requires care (key must include user id).

Most caching is best at CDN (closer to users); gateway-level caching is for shared backend responses.

### Cost concerns

Gateway is on every request — cost discipline:

- Latency budget: < 10ms steady-state at the gateway.
- Memory + CPU profile under load.
- Auto-scale per traffic.
- Per-environment sized (staging smaller than prod).

A slow gateway impacts every endpoint. Profile + tune.

### Failure mode: gateway as bottleneck

When the gateway can't be skipped, it's a single point of failure. Mitigations:

- **Multi-region**: per-region gateway (per [`multi-region-pattern.md`](./multi-region-pattern.md)).
- **Multi-AZ within region**.
- **Health checks + auto-replacement**.
- **Direct service access for internal callers**: services call each other directly when feasible, bypassing gateway.

### Service-to-service

Inside the cluster, services often call each other directly (mesh) rather than through the gateway:

- Gateway is for external traffic.
- Internal: service-mesh (per [`service-mesh-pattern.md`](./service-mesh-pattern.md)) handles cross-cutting (mTLS, observability, retries).

Don't route internal traffic through the external gateway. Adds latency; couples internal architecture to external entry.

### Deployment risk

Gateway deploys block every service. Mitigations:

- Canary deploys.
- Blue-green for the gateway specifically.
- Roll-forward only (per [`../quality/ci-cd-pipeline-pattern.md`](../quality/ci-cd-pipeline-pattern.md)).
- Practice gateway rollback (drill).

### Common failure modes

- **Fat gateway**: business logic crept in. → Refactor; move logic to services.
- **Gateway as a deploy gatekeeper**: services can't deploy without gateway change. → Stable contract; service-side changes don't require gateway changes.
- **Gateway as cache that lies**: stale data; users confused. → Conservative caching; service-driven invalidation.
- **No request-id propagation**: cannot trace requests. → Mandatory.
- **CORS handled in each service inconsistently**: → Centralise at gateway.
- **TLS termination at gateway only**: internal traffic plaintext. → mTLS internal (service mesh).

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Cloud-native | AWS API Gateway, GCP API Gateway, Azure APIM |
| Self-hosted | Kong, Tyk, KrakenD, Apache APISIX |
| Reverse-proxy | NGINX, Caddy, Envoy, Traefik, HAProxy |
| GraphQL federation | Apollo Router, Cosmo, Mercurius |
| BFF framework | Whatever your stack uses (Next.js, Nest.js, Rails, etc.) |

### Adoption path

1. **Few services**: ALB / Load balancer is enough; no "gateway" per se.
2. **~10 services**: reverse-proxy gateway with cross-cutting concerns.
3. **Multiple client types**: BFFs.
4. **Rich data graph**: GraphQL federation.
5. **Mature mesh**: gateway + service mesh; internal traffic doesn't traverse gateway.

### See also

- [`../security/rate-limiting-ddos-pattern.md`](../security/rate-limiting-ddos-pattern.md) — gateway-side rate limiting.
- [`../security/session-mgmt-pattern.md`](../security/session-mgmt-pattern.md) — token verification at gateway.
- [`service-mesh-pattern.md`](./service-mesh-pattern.md) — internal traffic.
- [`caching-cdn-pattern.md`](./caching-cdn-pattern.md) — CDN sits in front of gateway.
- [`anti-overengineering.md`](./anti-overengineering.md) — premature gateway = the canonical trap.
