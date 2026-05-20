# Multi-Region Pattern

How to operate across geographic regions for latency, availability, and data sovereignty — without losing your mind.

## TL;DR (human)

Multi-region is **operationally hard** and adds permanent complexity. Adopt only when at least one of three reasons holds: user latency forces it (global product), availability requires it (one region cannot be a single point of failure), data sovereignty mandates it (regulations require data-in-country). Otherwise stay single-region; vertical-scale longer.

## For agents

### Three reasons to go multi-region

| Reason | Symptom | Common minimum effective response |
|---|---|---|
| **Latency** | Users on other continents experience > 200ms RTT | CDN + edge cache for read-heavy; second region for write-heavy |
| **Availability** | Single-region outage = product down; SLA in jeopardy | Active-passive with documented failover |
| **Data sovereignty** | GDPR / LGPD / data-residency laws | Per-region data store; per-tenant region pinning |

If none of these holds, multi-region is overhead. Revisit yearly.

### Active-passive (start here)

- **One write region**, others stand by.
- Asynchronous replication: writes go to primary; replicas in other regions catch up.
- **Failover**: operator action; promotes a replica to primary. RTO = minutes; RPO = replication lag.
- **Reads**: can route to nearest region (with replication-lag tolerance) or always to primary (for strict consistency).

Pros: simple; one source of truth; well-understood failure modes.
Cons: failover requires action; cross-region writes are slow (round-trip to primary); no horizontal write scaling.

### Active-active with partition leaders

- Each **partition** (tenant, geographic block, customer) has a leader region.
- Writes for that partition succeed only in its leader region; reads can serve elsewhere.
- Failover: leader for a partition moves to another region; partition-level RTO = minutes; per-partition RPO = replication lag.

Pros: no global single point of failure; horizontal write scaling.
Cons: cross-partition operations are expensive (multi-region transactions); routing logic per write.

### Active-active with conflict resolution (CRDT / multi-leader)

- Any region can write any data. Conflicts merge automatically (CRDT) or are resolved by application logic.
- Reads serve from nearest region.
- Strong eventual consistency.

Pros: zero failover time for writes; lowest user-perceived latency.
Cons: conflict resolution complicates application logic; not all data shapes have natural merge functions (counters yes; strings no); expensive to retrofit.

Most products do not need this tier. Adopt only after exhausting partition-leader.

### Failover discipline

A failover plan is a runbook with:

1. **Triggers**: what conditions justify failover? (region down ≥ 5 min; sustained error rate > X%; manual override.)
2. **Decision authority**: who triggers? (Sometimes automated; usually human-in-loop for non-trivial systems.)
3. **Steps**: exact commands, in order, with expected duration per step.
4. **Verification**: how to confirm the failover worked.
5. **Rollback**: if the failover itself fails, how to revert.
6. **Communication**: who is told (engineering, support, customers).

**Drilled quarterly**. Untested failover plans do not work when needed.

### Data residency (sovereignty)

When regulations require data-in-country:

- **Per-tenant region pinning**: tenant's data writes go only to their region.
- **Schema includes residency tags**: each record knows where it lives.
- **Egress is region-aware**: a query against tenant X never touches storage outside X's region.
- **Audit logs are also region-pinned** (sometimes regulator-specific).

The boundary is the database, not the application. Application-level "always filter by region" is fragile; storage-level partitioning is durable.

### Geo-DNS / global load balancing

Front the system with:

- **Geo-DNS**: route DNS to nearest region.
- **Anycast IP**: same IP everywhere; BGP routes to nearest.
- **CDN / edge**: cached responses served close to user; cache miss routes to region.

The front layer is invisible to the application most of the time; it surfaces when a region is failing (geo-DNS / health checks should remove the failing region from rotation).

### Cross-region call discipline

Every call that crosses a region boundary is **slow** (tens to hundreds of ms RTT). Discipline:

- **Cache aggressively** at the consumer.
- **Batch** cross-region calls.
- **Avoid synchronous fanout** — N parallel calls to N regions = latency = max of all.
- **Idempotency required** — cross-region calls retry on network blip; non-idempotent retries corrupt state.

### Cost

Multi-region triples (or more) infrastructure cost:

- 3 regions = 3 copies of every service + 3 copies of every store + cross-region replication bandwidth.
- Operational cost rises: monitoring + on-call rotation per region + region-aware incident response.

Budget accordingly. Multi-region is not free; the business case must justify the cost.

### Per-pillar concerns at multi-region scale

**Security**:
- Vault per region (sealer keys stay in their region).
- Audit ledger per region; cross-region verification.
- RBAC scope checks region-aware.

**UI-UX**:
- User-perceived latency drops dramatically (the point).
- Failover during user session: UI must handle abrupt error + retry cleanly.

**Quality**:
- Tests cover multi-region scenarios (a partition test that pins a tenant to a region, then asserts the data does not appear in another).
- Failover game days quarterly.

**Governance**:
- RFC any cross-region contract change (every region must agree).

### Common failure modes

- **Adopting multi-region for "scale"** before single-region is exhausted. → Vertical-scale first. The single-region ceiling is high.
- **Active-active write conflict.** Two writes to the same record in two regions; one is lost without anyone noticing. → CRDT or partition-leader; never silent last-writer-wins.
- **Failover that has never been drilled.** Crisis day: runbook is wrong. → Quarterly drill.
- **Cross-region call inside a hot loop.** N × M latency = user waits seconds. → Cache or restructure.
- **Region-aware code mixed with non-region-aware code.** Mistakes inevitable. → All region-aware code goes through one region-router module.
- **Data sovereignty enforced in app code only.** A bypass leaks data cross-region. → Enforce in storage / network policy.

### When to roll back

Multi-region is sometimes a mistake. Rollback signals:

- Operational cost outweighs benefit.
- Engineering velocity craters because every change touches N regions.
- Failovers happen rarely; when they do, they don't work.

Rollback = consolidate to one region; tear down the rest in a careful migration. The cost of being multi-region wrong is high; honest evaluation matters more than sunk cost.

### See also

- [`distributed-data-pattern.md`](./distributed-data-pattern.md) — sharding + replication primitives.
- [`anti-overengineering.md`](./anti-overengineering.md) — multi-region is the canonical premature-flexibility trap.
- [`../security/multi-tenant-isolation-pattern.md`](../security/multi-tenant-isolation-pattern.md) — tenant-aware region pinning.
- [`../security/vulnerability-mgmt-pattern.md`](../security/vulnerability-mgmt-pattern.md) — patch cadence across regions.
- [`../quality/observability-pattern.md`](../quality/observability-pattern.md) — per-region SLOs.
