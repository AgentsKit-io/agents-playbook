---
type: Playbook Pattern
title: 'Contract Testing Pattern'
description: 'How to verify that consumer + provider agree on a contract, without expensive end-to-end tests.'
---

# Contract Testing Pattern

How to verify that consumer + provider agree on a contract, without expensive end-to-end tests.

## TL;DR (human)

Contract tests sit between unit tests (in-process) and E2E (real services). They verify that "consumer A's expectations of provider B" match "provider B's actual behavior" — independently, without running both at the same time. Pact is the canonical tool; consumer-driven contracts the canonical methodology.

## For agents

### What a contract test is

A contract is the shape of a request + response between two services. A contract test:

1. **Consumer** records its expectations as a pact file (which methods called, what params sent, what response expected).
2. **Provider** runs the pact file as a test (replays the expected requests; asserts responses match).

If both pass, the contract holds. Consumer + provider can deploy independently.

### Consumer-driven vs provider-driven

| Style | Driver | Use case |
|---|---|---|
| **Consumer-driven** | Consumer writes the contract; provider verifies | Many consumers; provider's job is to keep them all happy |
| **Provider-driven** | Provider publishes a spec (OpenAPI); consumer verifies | One provider; many consumers; provider sets the shape |

Consumer-driven (Pact) is more common in microservice meshes where a provider has many consumers and changes affect all.

### Where contract tests fit

| Test type | Speed | What it tests | Hits real network? |
|---|---|---|---|
| **Unit** | <10ms | Pure logic | No |
| **Contract** | 100ms-1s | Inter-service shape agreement | No (replayed) |
| **Integration** | seconds | Multiple in-process components | Sometimes |
| **E2E** | minutes | Whole system | Yes |

Contract tests **replace many integration / E2E tests** that exist only to verify "does service A talk to service B". Those are slow and flaky; contract tests are fast and deterministic.

### Pact mechanics

**Consumer side**:

```ts
// consumer.test.ts
const pact = new Pact({ provider: "user-service", consumer: "checkout-service" });

it("fetches user by id", async () => {
  await pact.addInteraction({
    state: "user 42 exists",
    uponReceiving: "a request for user 42",
    withRequest: { method: "GET", path: "/users/42" },
    willRespondWith: {
      status: 200,
      body: { id: 42, email: "x@y.com", role: "member" },
    },
  });

  // Test the consumer code against the mock.
  const user = await fetchUser("http://mock-host", 42);
  expect(user.id).toBe(42);
});
```

Pact file emitted: a JSON record of expectations.

**Provider side**:

```ts
// provider.test.ts
import { Verifier } from "@pact-foundation/pact";

it("honors all consumer pacts", async () => {
  await new Verifier({
    providerBaseUrl: "http://localhost:3000",  // real provider, running
    pactUrls: ["./pacts/checkout-service-user-service.json"],
    stateHandlers: {
      "user 42 exists": async () => { await seedUser(42); },
    },
  }).verifyProvider();
});
```

Provider replays each interaction; asserts response matches.

### Pact broker

A shared service stores pact files between consumer + provider CI:

- Consumer publishes after passing.
- Provider fetches + verifies.
- Provider publishes its current state ("verified vN against consumer X").
- A "can-i-deploy" check verifies a new version doesn't break any consumer.

Brokers: Pactflow (hosted), Pact Broker (self-hosted).

### Schema-first alternative

If you already have an OpenAPI / Protobuf / GraphQL schema:

- Provider tests verify implementation matches schema.
- Consumer tests verify consumed shape matches schema.
- A schema diff in CI catches breaks.

Cheaper than Pact if you have the schema discipline. Pact wins when consumer-side expectations are richer than the schema (e.g. specific field combinations).

### When NOT contract testing

- Single-service systems (no cross-service contracts).
- Public APIs with thousands of unknown consumers (you can't get pacts; use schema versioning + telemetry).
- Internal-only RPC where the contract package itself is the source of truth (per [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern)) — Zod schemas + dispatcher tests do most of the same work.

### What contract tests catch that unit tests don't

- Provider deployed with a field rename; consumer reads the old field; unit tests pass on both sides; production breaks.
- Provider tightened validation; consumer sends payloads that now reject; unit tests pass.
- Consumer started sending a new field the provider mis-parses.

Each surfaces only at the integration point. Unit tests on each side individually wouldn't catch.

### Failure modes contract tests don't catch

- Provider returns wrong **values** (correct shape, wrong content). → Integration tests.
- Network behavior (timeouts, retries, partial failures). → Chaos tests.
- Authentication / authorization correctness. → Security tests + integration.
- Performance regressions. → Load tests.

Contract tests verify **shape agreement**. They are not a substitute for other testing.

### Discipline

- One pact file per consumer-provider pair.
- Pact files committed to consumer's repo; published to broker on green CI.
- Provider verification in CI; "can-i-deploy" gate before promote.
- Pact file changes require consumer-team approval (changing expectations = changing contract).

### Anti-patterns

- **Pact mocks the provider in production tests**. Mock testing the mock. → Real provider for end-to-end; pacts for the contract.
- **Consumer pact tests pass without round-trip**. Consumer expects field X; provider doesn't return X; pact says "OK" because pact only asserts what's specified. → Strict matching mode.
- **Pact files diverge from real provider over time**. → Broker + can-i-deploy gates.
- **No state handlers**. Pact assumes data exists; provider doesn't have it. → State setup per interaction.

### Common failure modes

- **Contract tests but no broker**. Pacts on individual machines; provider has no idea. → Set up Pact broker; CI publishes.
- **No can-i-deploy gate**. Provider ships breaking change; consumers break. → Gate at deploy time.
- **Pacts cover happy path only**. Error paths not contracted. → Cover errors too (the provider returns this code in this situation).
- **Per-consumer differences not enforced**. Consumer A wants strict; consumer B wants lax. → One per consumer-provider pair.

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Contract testing | Pact, Spring Cloud Contract |
| Broker | Pactflow (hosted), Pact Broker (open source) |
| Schema-first | OpenAPI + Schemathesis / Dredd, GraphQL Inspector |
| gRPC | protobuf compatibility tooling (buf) |

### Adoption path

1. **Day 0**: schema-first (OpenAPI / Zod / Protobuf) covers most needs.
2. **Microservice ≥ 3**: introduce Pact for the most-contended consumer-provider pairs.
3. **Microservice ≥ 10**: broker; can-i-deploy gates.
4. **Many consumers**: consumer-driven Pact across the mesh.

Don't adopt Pact for a monolith. Wait for genuine consumer-provider distance.

### See also

- [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) — single-repo contract discipline.
- [`../architecture/api-versioning-pattern.md`](/docs/pillars/architecture/api-versioning-pattern) — schema evolution rules.
- [`test-pyramid.md`](/docs/pillars/quality/test-pyramid) — where contract tests fit.
- [`ci-cd-pipeline-pattern.md`](/docs/pillars/quality/ci-cd-pipeline-pattern) — can-i-deploy gate in pipeline.
