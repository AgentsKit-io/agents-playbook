# Phase 05 — Ship

How to turn a green main into a release without surprising consumers.

## Status

◐ Scoped, not yet detailed.

## Outputs

- A **release-gates** doc enumerating what must be true to tag.
- **Changesets** (or equivalent) per PR that ships consumer-visible change.
- **Versioning** discipline: semver per package, peer-dep compat matrix maintained.
- **Signed artifacts** for any binary distribution.
- A **cold prod-build walk-through** before declaring release-ready — the script the operator runs to validate, not the CI sign-off.

## Discipline

- Tests green ≠ demo-reachable. A cold prod build can hide route-gating bugs that fast CI does not catch.
- Investor-percent claims come from cold prod-build walks of the literal demo script, not from triage-derived health.
- Tombstone retired plans before tagging. Do not ship a release with a "PLAN.md" claiming work that is now done.
- Per-package coverage at threshold, per-package size budget honored.

## See also

- [`../../pillars/quality/README.md`](../../pillars/quality/README.md)
- [`../../pillars/governance/README.md`](../../pillars/governance/README.md) — tombstone pattern.
