# Plan followed

1. Upgrade `@agentskit/doc-bridge` 2.4.0 -> 2.4.2 (package.json and lockfile only).
2. Baseline: `ak-docs doctor` reported 78 / B, connectivity 19%.
3. Document the 11 undocumented code areas with `docs/for-agents/packages/*.md` (one `docbridge.covers` area each).
4. Cite packaged gate scripts only in patterns that the gates really implement.
5. Add `docs/bench/retrieval-suite-v1.json` (34 English cases; the docs are not bilingual) and a vitest test for it.
6. Measure: 95 / B, connectivity 65%, hit@3 100%, MRR 0.956.

Departure: connectivity 80% is not reachable truthfully. All 14 areas are documented, but 110 of 155
documents are generic pattern prose with no code they describe. Reaching 60% linked documents would need
about 48 more edges that would not be true, so I stopped short and report the gap.
