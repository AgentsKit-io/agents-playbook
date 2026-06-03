---
title: 'Pillar — Architecture'
description: 'How to keep a codebase **legible and modular under multi-agent development**.'
---

# Pillar — Architecture

How to keep a codebase **legible and modular under multi-agent development**.

The single biggest predictor of agent quality is whether the codebase tells the agent where to put new code. If the package boundaries are vague, agents pile features into the nearest big file. If the boundaries are explicit and named, agents route correctly even without supervision.

## Documents in this pillar

| Doc | Layer | Read when |
|---|---|---|
| [`universal.md`](/docs/pillars/architecture/universal) | Stack-agnostic principles | Designing any codebase |
| [`ts-concrete.md`](/docs/pillars/architecture/ts-concrete) | TS / pnpm / Turbo recipes | Implementing in a TS monorepo |
| [`adr-pattern.md`](/docs/pillars/architecture/adr-pattern) | Universal + TS | Recording a decision |
| [`rfc-pattern.md`](/docs/pillars/architecture/rfc-pattern) | Universal + TS | Proposing a breaking change |
| [`contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) | TS-concrete | Designing JSON-RPC / HTTP / IPC boundaries |
| [`error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy) | Universal + TS | Designing the error model |
| [`file-size-budget.md`](/docs/pillars/architecture/file-size-budget) | Universal + TS | Enforcing reviewability |
| [`anti-overengineering.md`](/docs/pillars/architecture/anti-overengineering) | Universal | Resisting agent default-to-abstract |
| [`feature-flags-pattern.md`](/docs/pillars/architecture/feature-flags-pattern) | Universal + TS | Decoupling deploy from release |
| [`api-versioning-pattern.md`](/docs/pillars/architecture/api-versioning-pattern) | Universal | Breaking-change deprecation lifecycle |
| [`distributed-data-pattern.md`](/docs/pillars/architecture/distributed-data-pattern) | Universal | Replicas, sharding, CAP, eventual consistency |
| [`multi-region-pattern.md`](/docs/pillars/architecture/multi-region-pattern) | Universal | Geo failover, sovereignty, RPO/RTO |
| [`event-streaming-pattern.md`](/docs/pillars/architecture/event-streaming-pattern) | Universal | Queues, pub/sub, streams; idempotency; DLQ; schema evolution |
| [`caching-cdn-pattern.md`](/docs/pillars/architecture/caching-cdn-pattern) | Universal | 3 cache tiers; TTL discipline; invalidation; key scoping |
| [`api-gateway-pattern.md`](/docs/pillars/architecture/api-gateway-pattern) | Universal | Edge ingress; what belongs vs not; BFF; GraphQL federation |
| [`service-mesh-pattern.md`](/docs/pillars/architecture/service-mesh-pattern) | Universal | Sidecar mTLS; retries; observability; when to adopt vs not |
| [`platform-engineering-idp-pattern.md`](/docs/pillars/architecture/platform-engineering-idp-pattern) | Universal | Internal Developer Platform; golden paths; DORA metrics |
| [`iac-pattern.md`](/docs/pillars/architecture/iac-pattern) | Universal | Infrastructure as code; modules; state; drift; cost forecast |
| [`offline-first-sync-pattern.md`](/docs/pillars/architecture/offline-first-sync-pattern) | Universal | Local persistence; sync protocols; conflict resolution; CRDT |

## The core idea

A codebase has three architectural surfaces, and each one needs a different kind of documentation:

1. **Boundaries** — what depends on what. Documented as a package routing table.
2. **Decisions** — why the boundaries are where they are. Documented as ADRs.
3. **Contracts** — what crosses boundaries. Documented as Zod (or equivalent) schemas, with stable error codes and versioning.

If any of the three is implicit, agents will reinvent it differently each session.

## Anti-patterns this pillar prevents

- Agents reimplementing upstream primitives because the routing table didn't say where they live.
- Agents proposing breaking changes in a PR description instead of an RFC, so the change is invisible to future agents.
- Agents throwing raw `new Error('...')` at a JSON-RPC boundary, making the error opaque in the client.
- Files growing to 1500 lines because no budget said "extract".
- Two agents creating sibling packages that re-export the same primitive under different names.

## How to adopt

1. Read [`universal.md`](/docs/pillars/architecture/universal). Internalize the five non-negotiables.
2. Write your project's `AGENTS.md` routing table (template in [`../../templates/AGENTS.md.template.md`](/docs/templates/AGENTS.md.template)).
3. Stand up ADR + RFC directories (templates in [`../../templates/`](/docs/templates)). Number the first ADR "Philosophy".
4. Wire structural gates from [`../../scripts/`](/docs/scripts) — the file-size, named-export, and no-`any` gates pay back in week one.
5. Add an ADR every time an agent proposes a structural change. Reject the change if there is no ADR.
