---
type: Playbook Pattern
title: 'Property-Based & Fuzz Testing Pattern'
description: 'How to test the laws your code must obey, instead of guessing individual inputs — and how this catches crypto and parser bugs example tests never will.'
---

# Property-Based & Fuzz Testing Pattern

How to test the laws your code must obey, instead of guessing individual inputs — and how this catches crypto and parser bugs example tests never will.

## TL;DR (human)

Example-based tests check the inputs you thought of. Property-based tests state a law ("this must always hold") and let a generator throw thousands of inputs at it, shrinking any failure to a minimal counterexample. Fuzzing does the same with adversarial bytes at your parsing and crypto boundaries. Reserve both for high-value pure logic and trust boundaries — they routinely surface bugs (malleability, non-idempotent redaction, lost precision) that no hand-written test ever names.

## For agents

### Example tests vs property tests

An example test asserts `f(2) === 4`. A property test asserts a *law* over a generated domain:

```ts
property("parse then serialize round-trips", anyValidInput, (x) => {
  expect(parse(serialize(x))).toEqual(x);
});
```

The framework (fast-check, Hypothesis, QuickCheck, proptest, …) generates hundreds of inputs, and when one fails it **shrinks** to the smallest reproducing case. One property can replace fifty examples *and* find the edge case you never wrote.

### The invariant catalogue

Most pure logic obeys one of a small set of laws. Look for these — each is a ready-made property:

| Invariant | Law | Where it lives |
|---|---|---|
| Round-trip | `decode(encode(x)) == x` | serializers, envelopes, codecs |
| Idempotence | `f(f(x)) == f(x)` | redaction, sanitisation, normalisation, retries |
| Associativity / commutativity | `merge(a, merge(b,c)) == merge(merge(a,b), c)` | config merge, CRDT-ish state, reducers |
| Injectivity | `a != b ⟹ id(a) != id(b)` | slug/key derivation, hashing to identifiers |
| Ordering / monotonicity | output order respects a defined sort; counters never go backwards | pagination, lamport/logical clocks, budgets |
| Conservation | sum in == sum out | accounting, quota arithmetic, splitting/merging |

If you can name the law, you can test it — and the generator will attack it harder than you would.

### Worked example — idempotence catches a real leak

Redaction is supposed to be idempotent: redacting already-redacted text changes nothing, and one pass redacts everything. A naive implementation applies word-boundary-anchored rules once. A property test of `redact(x) == redact(redact(x))` finds the counterexample where a secret glued to a following token escapes the first pass and is only caught after a *later* rule creates the boundary. The fix is to apply rules to a fixed point. No example test would have named that input; the generator does.

### Fuzzing the trust boundary

Property generators produce *valid* inputs. Fuzzers produce *hostile* ones. Point a fuzzer at every parser and crypto boundary that ingests bytes from outside the trust boundary:

- Envelope / token / signature parsers — malformed, truncated, type-confused fields.
- Wire framing (length-prefixed, newline-delimited, multipart) — split, oversized, zero-length frames.
- Config / markup parsers — deeply nested, cyclic, prototype-polluting payloads.

The bar: a hostile input must produce a typed, contract-shaped error — never a raw runtime exception, an unbounded allocation, or a silent accept. See [`../architecture/error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy).

### Worked example — Merkle malleability (a property a crypto boundary must hold)

A tamper-evidence claim ("the digest binds these exact items") is a property: two *different* item sets must never produce the same root. A classic implementation duplicates the last node when a tree level has an odd count — which makes `[a, b, c]` and `[a, b, c, c]` collide (the second-preimage flaw catalogued as CVE-2012-2459). A property test asserting *distinct inputs ⟹ distinct roots* finds it; the fix is domain separation (hash leaves and internal nodes with different prefix bytes, per RFC 6962) and promoting lone nodes instead of duplicating them. This is exactly the kind of defect example tests never reach and property/fuzz tests reliably do. See [`../security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern).

### Discipline

- **Run dependency-free harnesses against the built artifact**, not against mocks — you are testing real behavior at the boundary.
- **Seed for reproducibility.** When a property fails, pin the failing seed and the shrunk counterexample as a normal regression test. The property keeps hunting; the example locks the bug.
- **Keep generators honest.** A generator that only produces trivial inputs proves nothing. Bias toward boundaries: empty, single-element, max-size, surrogate/unicode edges, negative and zero.
- **Scope to high-value code.** Pure functions with a clear input domain and trust boundaries — not UI, not glue.

### When to introduce

After the unit suite is stable. Property/fuzz tests are noisy on incomplete code and most valuable on logic whose correctness *matters*: codecs, crypto, accounting, identifiers, merge/conflict logic, parsers.

### Common failure modes

- **Only example tests on a parser/crypto boundary.** The hostile input nobody imagined ships a vulnerability. → Fuzz the boundary; assert typed errors.
- **A failing property with no pinned counterexample.** The bug recurs because nothing locks it. → Save the shrunk case as a regression test.
- **Generators that never hit edges.** Green properties, false confidence. → Bias generators toward boundaries.
- **Property tests on impure code.** Flaky, slow, meaningless. → Reserve for pure functions and boundaries.
- **Treating an invariant as obvious instead of asserting it.** "Of course distinct inputs give distinct roots." They didn't. → If you can state the law, write the property.

### Tools by language

| Language | Property-based | Fuzzing |
|---|---|---|
| JS / TS | fast-check | jsfuzz, built-in via fast-check arbitraries |
| Python | Hypothesis | atheris |
| Java / Kotlin | jqwik | Jazzer |
| Rust | proptest, quickcheck | cargo-fuzz |
| Go | testing/quick | native `go test` fuzzing (`func FuzzX`) |

### See also

- [`test-pyramid.md`](/docs/pillars/quality/test-pyramid) — where property tests sit; coverage as a precondition.
- [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern) — complementary; mutation scores the tests, properties score the laws.
- [`adversarial-bug-hunt-pattern.md`](/docs/pillars/quality/adversarial-bug-hunt-pattern) — property/fuzz harnesses feed the find stage.
- [`../security/audit-ledger-pattern.md`](/docs/pillars/security/audit-ledger-pattern) — Merkle malleability hardening.
- [`../architecture/error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy) — hostile input must produce a typed error.
