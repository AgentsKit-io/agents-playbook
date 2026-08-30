# ADR-0030: Provenance-bearing external coding benchmark bridge

## Decision

Keep the harness benchmark schema portable and add optional task provenance:
the source repository, immutable revision, prompt path and digest, and read /
write scope. Validate the existing AgentsKit OS coding benchmark report through
a small dependency-free adapter.

The adapter validates report integrity only. Provider status, completeness
heuristics, and `successPassed` are observations; they do not grant human
acceptance or make a benchmark comparable without a controlled baseline,
criterion evidence, and a `COMPLETE` harness run.

## Consequences

The same manifest can be checked from another agent or repository, while the
AgentsKit OS benchmark remains responsible for running providers. Phase 28
ships the seed corpus and bridge. Real baseline collection across repeated,
reviewed tasks is the next measurement step; no improvement claim is made here.
