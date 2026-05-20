---
title: 'Service Mesh Pattern'
description: 'How to handle cross-service communication concerns (mTLS, retries, observability, routing) without coding them in every service.'
---

# Service Mesh Pattern

How to handle cross-service communication concerns (mTLS, retries, observability, routing) without coding them in every service.

## TL;DR (human)

A service mesh injects a sidecar proxy alongside every service. The proxy handles cross-cutting: mTLS, retries, timeouts, traffic shaping, metrics, traces. Services talk to localhost; mesh handles the rest. Powerful but operationally heavy — only adopt when service count + complexity justify.

## For agents

### What a mesh provides

| Concern | Mesh-provided |
|---|---|
| mTLS between services | ✓ |
| Retries with backoff | ✓ |
| Timeouts | ✓ |
| Circuit breaking | ✓ |
| Load balancing | ✓ |
| Traffic shaping (% canary) | ✓ |
| Metrics (golden signals per service-pair) | ✓ |
| Distributed traces | ✓ (auto-instrumented) |
| Access control between services | ✓ |
| Rate limiting (cross-service) | ✓ |

Without a mesh, each service implements (badly, inconsistently) most of these.

### Cost

Operational cost:

- Sidecar per pod = N× memory + CPU overhead.
- Control plane is itself a system to operate.
- Debugging adds a layer (is it the service, the sidecar, the network?).
- Upgrade cadence (mesh version drift = pain).

Adopt when service count > ~20 + the cross-cutting concerns are recurring pain. Smaller fleets: pick libraries instead.

### The sidecar model

```
┌──────────────────────┐
│ Pod                  │
│ ┌────────┐ ┌───────┐ │
│ │service │←│sidecar│←──── traffic
│ │  app   │→│ proxy │ │
│ └────────┘ └───────┘ │
└──────────────────────┘
```

App talks to localhost. Sidecar handles outbound and inbound traffic. Control plane configures sidecars.

### mTLS

Mutual TLS between services:

- Every service has a cert (issued by mesh).
- Every connection authenticates both sides.
- Encryption + identity baked in.

Without mTLS, internal traffic is plain. A network compromise reads it. mTLS makes lateral movement much harder.

### Traffic management

Mesh enables:

- **Canary deploy**: route 1% to new version; promote on metrics.
- **A/B routing**: header-based; serve different versions per condition.
- **Blue-green**: route 100% to new; rollback by re-routing.
- **Mirror traffic**: send shadow copy to new version (no response used).
- **Fault injection**: deliberately add latency / errors to test resilience.

These are tools — not features the app needs to implement.

### Retry + timeout discipline

Each service-to-service hop has policy:

```yaml
- destination: user-service
  retries: 3
  retry-on: 5xx,connect-error
  timeout: 5s
  per-try-timeout: 1s
  circuit-breaker:
    consecutive-errors: 5
    interval: 30s
```

Policy in mesh config, not in code. Adjusted operationally without app deploy.

Risk: retry storms — every layer retries; downstream amplification = upstream's incident becomes catastrophic. Configure with awareness; sometimes the right answer is *don't retry*.

### Observability gain

Mesh gives golden signals per service-pair for free:

- Request rate.
- Error rate.
- Duration (p50/p95/p99).
- Plus traces auto-instrumented.

Reduces per-service instrumentation burden. Cost: high-cardinality metric storage.

### Access policy

Cross-service auth:

- "Service A can call service B" (allow).
- "Service C cannot call service B" (deny).
- "Service A can call /users/* on B but not /admin/*".

Policy in mesh. Service implementations don't need to verify caller — mesh does it.

Useful for compliance: prove via policy that only authorised services touch sensitive data.

### Multi-cluster + multi-region

Mature mesh deployments span clusters / regions:

- One mesh control plane manages multi-cluster.
- Service "x in cluster A" calls "x in cluster B" if local fails.
- Cross-cluster traffic also mTLS.

Operational complexity rises. Worth it for global products; overkill for single-region.

### When NOT to adopt

- Service count < 10 — overhead exceeds benefit.
- Single-team — no need for cross-team policy enforcement.
- Team without operational expertise — mesh failures are subtle.
- Latency-sensitive (sub-ms RPCs) — sidecar adds ~1ms.

Libraries (resilience4j, Polly) cover most resilience needs at < 5 services.

### Lighter-weight alternatives

| Need | Lighter alternative |
|---|---|
| mTLS only | SPIFFE / SPIRE without full mesh |
| Retries + circuit-break | Application-level libraries |
| Observability | OpenTelemetry SDKs |
| Routing | Application-level service discovery (Consul, Eureka) |

Get the value piece by piece without committing to full mesh.

### Common failure modes

- **Premature adoption**. Mesh installed; team doesn't understand failure modes; outage. → Demonstrated need first.
- **Sidecar OOM**. Sidecar runs out of memory; service unreachable. → Resource limits per sidecar; alerts.
- **Configuration drift**. Mesh config differs from intent. → GitOps-managed.
- **Retry amplification**. Mesh retries; service also retries; upstream sees N² requests. → One layer retries.
- **Latency budget consumed by mesh**. Sidecar adds ms; user-facing budget breached. → Profile; tune mesh.
- **Debugging "where is the failure"**. Service blames sidecar; sidecar blames service. → Tracing must traverse both.
- **Upgrade fear**. Mesh version stale; security patches lag. → Operational discipline; staging-mesh first.

### Tooling stack (typical)

| Mesh | Notes |
|---|---|
| **Istio** | Most feature-rich; operational complexity |
| **Linkerd** | Simpler; Rust sidecar; smaller surface |
| **Cilium Service Mesh** | eBPF-based; sidecar-less option |
| **Consul Connect** | HashiCorp's; integrates with their ecosystem |
| **AWS App Mesh** | Cloud-managed; AWS-specific |
| **Open Service Mesh** | CNCF; less mature, less active |

For new adopters: Linkerd if minimal; Istio if mature ops team; Cilium for k8s-native.

### Adoption path

1. **< 10 services**: libraries.
2. **10-30 services + cross-team needs**: introduce mesh in one part of the system; learn ops.
3. **30+ services**: full mesh adoption; multi-cluster considered.
4. **Multi-region**: mesh spans regions.

### See also

- [`api-gateway-pattern.md`](./api-gateway-pattern.md) — gateway for external; mesh for internal.
- [`multi-region-pattern.md`](./multi-region-pattern.md) — mesh in multi-region.
- [`anti-overengineering.md`](./anti-overengineering.md) — mesh is the canonical premature complexity.
- [`../quality/observability-pattern.md`](../quality/observability-pattern.md) — mesh contributes signals.
- [`../security/rbac-pattern.md`](../security/rbac-pattern.md) — service-to-service auth interplay.
