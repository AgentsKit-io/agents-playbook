---
title: "Event Streaming Pattern"
description: "How to design async, decoupled communication via queues, pub/sub, and event streams — without losing events, double-processing, or stalling consumers."
---

# Event Streaming Pattern

How to design async, decoupled communication via queues, pub/sub, and event streams — without losing events, double-processing, or stalling consumers.

## TL;DR (human)

Three primitives: **queues** (work-distribution; one consumer per message), **pub/sub topics** (broadcast; many independent consumers), **event streams** (durable log; replayable; ordered per partition). Choose by use case. Discipline: idempotency on every consumer, dead-letter queue, schema evolution, replay tooling, backpressure handling. The hardest mistakes are subtle — re-delivery semantics, ordering guarantees, exactly-once myths.

## For agents

### Three primitives

| Primitive | Semantics | Use case | Examples |
|---|---|---|---|
| **Queue** | At-least-once; one consumer per msg; FIFO or fair | Work distribution (jobs) | SQS, RabbitMQ, BullMQ |
| **Pub/sub topic** | At-least-once; fanout to N subscribers; usually no ordering | Notify many independent consumers | SNS, Cloud Pub/Sub, Redis pub/sub |
| **Event stream** | Durable log; ordered per partition; replayable | Event-sourced systems; analytics pipelines | Kafka, Kinesis, NATS JetStream, Redpanda |

Mixing primitives is normal (queue + topic + stream). Picking the wrong one is costly.

### Delivery semantics — the truth

Three theoretical options:

- **At-most-once**: messages may be lost; never duplicated.
- **At-least-once**: messages always delivered; may be duplicated.
- **Exactly-once**: each message processed exactly once.

In practice:

- Most production systems are **at-least-once**.
- "Exactly-once" usually means **at-least-once + idempotent consumer**.
- True end-to-end exactly-once exists in some systems (Kafka transactions + transactional sinks) but is expensive and narrow.

**Design for at-least-once + idempotency.** It is the most cost-effective and most robust pattern.

### Idempotency — non-negotiable

Every consumer must handle duplicate delivery. Pattern:

```ts
async function handler(msg: Message) {
  const idempotencyKey = msg.headers["x-idempotency-key"] ?? msg.id;

  // Has this been processed?
  const existing = await db.processedMessages.findUnique({ where: { idempotencyKey } });
  if (existing) {
    logger.info("duplicate.skipped", { idempotencyKey });
    return existing.result;
  }

  // Process atomically with idempotency record.
  return await db.transaction(async (tx) => {
    const result = await doWork(msg, tx);
    await tx.processedMessages.create({ data: { idempotencyKey, result } });
    return result;
  });
}
```

The idempotency record + the side-effect commit in **one transaction**. Half-states get the producer to retry safely.

Where transactions cross stores (e.g. external API + local DB), apply the outbox pattern (see [`distributed-data-pattern.md`](./distributed-data-pattern.md)).

### Ordering guarantees

| Primitive | Ordering |
|---|---|
| Standard SQS | No order guaranteed |
| SQS FIFO | Per message-group ordered |
| Kafka / Kinesis | Per partition ordered |
| Redis Streams | Per stream ordered |
| RabbitMQ classic queues | Per queue ordered (but with consumer caveats) |

The shard / partition key chooses ordering scope. Common choice: tenant id (events per tenant ordered; cross-tenant unordered).

If the consumer needs global order, you have one partition; you have one consumer's throughput; you have a bottleneck. Avoid.

### Dead-letter queue (DLQ)

Messages that fail repeatedly route to DLQ:

- After N retries (e.g. 5).
- Or after specific terminal errors (validation failure, missing entity).

DLQ is **inspected** — manually or via tooling. Each DLQ message is a bug:

- The message is malformed (producer bug).
- The handler has a regression (consumer bug).
- An upstream dependency is permanently down (deeper issue).

Never silently delete DLQ. Inspect; fix; replay.

### Backpressure

When consumers are slow relative to producers, the queue grows.

Options:

- **Auto-scale consumers**: more workers; faster drain. Bounded by downstream capacity (DB, external APIs).
- **Producer back-pressure**: producers slow down on queue-depth signal. Hard to retrofit.
- **Drop oldest** (queue-depth cap): some workloads tolerate it (notifications). Most don't.
- **Spillover**: route to slower / cheaper storage at queue-depth threshold.

The wrong answer is to silently fall behind. Set alerts on queue depth + age of oldest message.

### Schema evolution

Producers + consumers deploy independently. Their schemas must coexist across versions.

Rules:

- **Add fields**: new fields are optional with defaults. Old consumers ignore.
- **Rename fields**: requires deprecation cycle (per [`api-versioning-pattern.md`](./api-versioning-pattern.md)) — keep both names during transition.
- **Remove fields**: requires guarantee no consumer reads them. Audit; deprecate; remove.
- **Type changes**: breaking; new event name preferred.

A **schema registry** (Confluent Schema Registry, Glue Schema Registry, in-house) enforces compatibility:

- Producer registers schema at publish time.
- Compatibility check: would old consumers parse this?
- Reject incompatible schemas at publish.

Without a registry, schema drift produces consumer crashes that are hard to diagnose.

### Replay + reprocessing

For event streams (durable):

- **Replay from offset**: rewind a consumer; reprocess from N.
- **Replay to dev**: snapshot prod stream; replay locally.
- **Backfill**: a new consumer joins; processes the full history.

For queues (non-durable):

- Replay = manually re-publishing from logs / archive.

Tooling discipline: a replay command exists; it's safe; it's tested.

### Idempotency across replays

Replaying produces duplicates. The same idempotency-key pattern handles it — as long as the idempotency-keys are stable across runs.

Counter-example: `idempotencyKey = uuid()` generated at processing time → every replay produces a "new" message. Stable keys are essential.

### Event sourcing — the heavyweight pattern

Some systems persist *only* the event stream; current state is a projection.

Pros: full audit trail; replay rebuilds state; new projections retroactively serve new use cases.

Cons: every query goes through projections; schema evolution is hard; migrations are replays.

**Adopt event sourcing deliberately**, not by accident. It is a significant architecture commitment.

For most products: regular CRUD with an outbox of domain events is the right balance. Full event sourcing for systems where the event history IS the value (audit, financial systems, multi-step workflows).

### CQRS — the companion pattern

Command Query Responsibility Segregation: write models and read models differ.

- Commands go to one shape (often the event stream).
- Queries hit one or more projections optimised for the query shape.

Useful when:

- Read and write loads are very different.
- Multiple read projections benefit from the same write events.
- Eventual consistency is acceptable for reads.

Overhead: two models to maintain; eventual consistency to communicate.

### Event-driven UX

When the user triggers an action that goes async:

- **Optimistic UI**: show success immediately; reconcile on event-back.
- **Status surface**: explicit "running…" / "completed" / "failed".
- **Idempotent retries**: user clicks twice; second click finds the in-flight job.

Don't hide async-ness from the user; surface it.

### Cost concerns

Event-streaming infrastructure costs:

- **Per-message**: SQS, SNS price per million.
- **Per-throughput**: Kafka, Kinesis charge for provisioned throughput.
- **Per-storage**: retention beyond 7 days = paid storage.

Tuning:

- Batch publishes where latency allows.
- Compress payloads (Snappy, gzip).
- Tune retention to actual replay window.
- Per-tenant tagging for attribution (per [`../quality/cost-optimization-pattern.md`](../quality/cost-optimization-pattern.md)).

### Anti-patterns

- **Synchronous-over-async**: producer blocks waiting for consumer ack. Defeats decoupling.
- **Event names that encode internal state**: `UserRowVersion3UpdatedColumnX`. Producers leak DB structure to consumers.
- **Fat events**: 100 KB payloads. Consumers parse the whole world. → Small events + reference to canonical store.
- **Anaemic events**: just an id. Consumers re-fetch everything. → Include enough for common consumers.
- **Topic per consumer**: defeats decoupling. → One topic; many consumers.
- **No DLQ**: failing messages retry forever; queue grows; outage. → DLQ + alerts.
- **No idempotency**: duplicates produce double-charges, double-emails. → Idempotency-key everywhere.

### Common operational failures

- **Consumer lag spike** → backpressure; investigate downstream.
- **DLQ filling** → consumer regression; inspect first message.
- **Schema deploy breaks consumers** → registry was bypassed; rollback; enforce registry.
- **Replay duplicated work** → idempotency-key not stable.
- **Lost messages** → at-most-once setting; switch to at-least-once + ack.
- **Out-of-order in supposedly-ordered partition** → consumer-side concurrency violates ordering; serialize.

### Tooling stack (typical)

| Primitive | Tool |
|---|---|
| Managed queue | AWS SQS, GCP Tasks, Azure Service Bus |
| Self-hosted queue | RabbitMQ, BullMQ (Redis-backed) |
| Pub/sub | AWS SNS, GCP Pub/Sub, NATS |
| Event stream | Kafka, Confluent Cloud, Redpanda, AWS Kinesis, Azure Event Hubs |
| Schema registry | Confluent SR, AWS Glue SR, in-house JSON schema repo |
| Workflow engine | Temporal, AWS Step Functions, Inngest |
| Job scheduler | BullMQ, Sidekiq, Celery |

### See also

- [`distributed-data-pattern.md`](./distributed-data-pattern.md) — outbox pattern feeds event streams.
- [`api-versioning-pattern.md`](./api-versioning-pattern.md) — schema evolution rules.
- [`anti-overengineering.md`](./anti-overengineering.md) — event sourcing is the canonical premature complexity.
- [`../quality/observability-pattern.md`](../quality/observability-pattern.md) — queue depth, lag, DLQ size are key metrics.
- [`../quality/cost-optimization-pattern.md`](../quality/cost-optimization-pattern.md) — event-stream cost.
- [`../security/audit-ledger-pattern.md`](../security/audit-ledger-pattern.md) — append-only ledger is a specialized event stream.
