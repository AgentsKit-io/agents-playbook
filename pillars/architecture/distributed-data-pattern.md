# Distributed Data Pattern

How to design data layout when one database stops being enough — read replicas, sharding, replication lag, CAP trade-offs, eventual consistency.

## TL;DR (human)

Distributed data starts with **read replicas** (cheap, mostly transparent). Then **sharding** (expensive, design-defining). Then **multi-region** (operationally hard, recovery-defining). Each step trades consistency for availability and complexity. Pick the cheapest one that solves the actual problem; do not adopt the next tier speculatively.

## For agents

### The CAP triangle, briefly

A distributed system under partition can guarantee at most two of: **C**onsistency, **A**vailability, **P**artition tolerance. Real systems are not on the corners — they pick a position on the edges.

- **CP** (consistency over availability under partition): banking, audit ledgers. Reads/writes refuse if quorum unreachable.
- **AP** (availability over consistency): social feed, analytics. Reads/writes succeed; data is eventually consistent.
- **CA** (no partition tolerance — only viable in a single node).

You will be **AP** for most user-facing data and **CP** for money + audit + identity.

### Step 1 — Read replicas

Cheap, mostly transparent. One primary handles writes; N replicas serve reads.

Rules:

- **Writes go to primary.** Always.
- **Reads with strict freshness go to primary.** Authentication, "did my write land", post-transaction reads.
- **Reads that tolerate staleness go to replicas.** Listings, dashboards, analytics.
- **The application layer chooses**: `db.replica.users.list(...)` vs `db.primary.users.list(...)`. Not the ORM's auto-magic. Auto-routing produces surprise replication-lag bugs.

Replication lag:

- Typically tens to hundreds of milliseconds in steady state.
- Spikes to seconds under load.
- Tail can reach minutes during failover.

Design your queries to tolerate the worst-case lag, or send the affected query to primary.

### Step 2 — Sharding

When data per primary exceeds what one node handles — typically when total data approaches a TB or QPS exceeds 10k+ — shard.

Shard key choice is permanent (or at least very expensive to change). Get it right.

**Good shard keys**:

- `tenant_id` / `workspace_id` for multi-tenant systems (most queries are per-tenant).
- `user_id` for user-facing systems.
- Time-bucketed for append-heavy systems (event logs).

**Bad shard keys**:

- Auto-increment id (sequential = hot last shard).
- `created_at` only (hot active shard).
- Anything that produces "one big shard" (one popular tenant).

Cross-shard queries are expensive. Design queries so 95%+ stay within a shard.

**Resharding** is its own discipline:

- Pre-split into more shards than you currently need (over-shard).
- Use logical shards mapped to physical nodes; moving a logical shard is a node-add operation.
- Tools: Vitess, Citus, application-level sharding with consistent hashing.

### Step 3 — Multi-region

When users are distributed globally OR the failure of one region must not take the system down — multi-region.

Three patterns:

1. **Active-passive**: one region writes; others stand by. Failover is operator-driven; RPO = replication lag, RTO = minutes.
2. **Active-active with leader per partition**: each partition (tenant, customer, geographic block) has a leader region. Writes to your data only succeed in your region. Cross-partition operations are rare and expensive.
3. **Fully active-active with CRDT / multi-leader**: writes succeed anywhere; conflicts resolved at the data layer. Expensive but powerful.

Most products start at 1. Mature SaaS at 2. Few need 3.

### RPO / RTO

Per system, document:

- **RPO** (Recovery Point Objective): how much data can we lose in a disaster? "5 minutes" means replication is configured for ≤ 5-min lag.
- **RTO** (Recovery Time Objective): how long to be back up? "30 minutes" means the failover procedure must complete within that.

RPO and RTO are *promises*. The infrastructure must be able to deliver them; the runbook must be tested.

### Replication lag — visible in product

When you have replicas, replication lag becomes a product concern:

- **Write-then-read in the same request**: route the read to primary or use a session-pinned router.
- **Write-then-read across requests**: use a "version cookie" — the write returns a version stamp; the next read carries it; the read either waits or routes to primary.
- **List-after-create**: the new record may not appear in the listing for a few hundred ms. Either send the listing to primary or surface the new record optimistically in the UI.

This is **eventual consistency in disguise**. Document it; expect it.

### Eventual consistency UX

When eventual consistency is exposed to users:

- Communicate optimistically: show the new state immediately in the UI, even if the read hasn't caught up.
- Reconcile on next reload: if the optimistic state was wrong, show the truth, with an explanation.
- Avoid surfaces where strict consistency is expected (financial balances, audit logs).

### Distributed transactions

Avoid. They are slow, fragile, and cap throughput.

When you genuinely need atomicity across two stores:

- **Saga**: a sequence of local transactions + compensations. Each step can fail; compensate the prior steps. Common for orchestrated workflows.
- **Outbox**: write changes to an outbox table in the same transaction as the business write; a separate process publishes the outbox events.
- **Two-phase commit**: only when latency / availability constraints allow. Rare in modern systems.

The discipline: prefer single-store atomic operations + sagas + outboxes over distributed transactions.

### Distributed ID generation

Auto-increment IDs do not work across shards.

| Approach | Pros | Cons |
|---|---|---|
| UUID v4 | Trivial; collision-free | Random insert order kills B-tree performance |
| UUID v7 / ULID | Sortable + collision-free | Standard support varies |
| Snowflake | Sortable + compact | Coordination layer; clock-sensitive |
| KSUID | Sortable; URL-safe | Larger than auto-increment |
| Pre-allocated ranges per shard | Sortable + fast | Coordination at allocation time |

Default: ULID. Sortable, collision-free, compact, library support broad.

### Caching tiers

When the database is the bottleneck, caching tiers absorb load:

1. **In-process cache**: per-process; ~ms latency; short TTL. For read-heavy, low-mutation data.
2. **Distributed cache** (Redis, Memcached): cross-process; sub-ms in-region; medium TTL. For shared-read data.
3. **CDN**: edge cache; ~ms latency globally; long TTL. For public content + static assets.

Cache invalidation is the second hard problem. Three strategies:

- **Time-based** (TTL): simple; stale-but-bounded.
- **Event-based**: on write, evict / update relevant cache entries. Complex; risk of bugs.
- **Versioned keys**: each entity has a version; key includes version; updates produce new keys.

Versioned keys are surprisingly powerful; consider them before event-based invalidation.

### Common failure modes

- **Adopting sharding before exhausting a vertical scale.** A single big primary handles enormous load; sharding adds complexity for no benefit. → Measure first; vertical-scale first.
- **Shard key chosen by intuition, not data.** Hot shard; resharding misery. → Analyze actual query patterns.
- **Cross-shard queries everywhere.** Sharded but with the cost of unsharded. → Audit queries; >95% should be single-shard.
- **Replication lag ignored in code.** Write-then-read inconsistency surfaces as random bugs. → Explicit primary/replica routing.
- **Multi-region without RPO/RTO documented.** Failover happens; nobody knows what was lost. → Document; drill.
- **Cache invalidation via event-broadcast, no fallback.** Event missed → stale forever. → TTL as a backstop on every cache.

### See also

- [`anti-overengineering.md`](./anti-overengineering.md) — distributed data is the canonical over-engineering trap.
- [`multi-region-pattern.md`](./multi-region-pattern.md) — operational concerns at region scope.
- [`../security/multi-tenant-isolation-pattern.md`](../security/multi-tenant-isolation-pattern.md) — tenancy + sharding interplay.
- [`../quality/observability-pattern.md`](../quality/observability-pattern.md) — measure replication lag, cache hit rate, query distribution.
