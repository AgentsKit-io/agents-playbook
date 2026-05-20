---
title: 'Pillar — Governance'
description: 'How multiple agents (and humans) coordinate work in one repo without subtracting each other''s progress.'
---

# Pillar — Governance

How multiple agents (and humans) coordinate work in one repo without subtracting each other's progress.

## Status

◐ Scoped, not yet detailed.

## Scope

| Concern | Universal principle | Concrete pattern |
|---|---|---|
| PR intent manifest | Every PR declares what it adds / removes / changes; reviewers verify against it | `pr-intent.yaml` parsed by a gate; renames + removes require explicit `removes:` entries |
| Merge rules | Merges sum work, never subtract | Agents may not `git checkout --theirs/--ours` without `merge-override: \<reason\>` annotation |
| Concurrent-agent awareness | Other agents may be editing the same files | Session start: `git fetch`, recheck issue state, look for in-flight PRs touching the same paths |
| One sub-unit per session | Big phases split into discrete, shippable sub-units | Sub-unit defined before starting; no scope creep mid-session |
| Phased PR + admin merge | Long initiatives ship as a chain of phase PRs | `gh pr merge --merge --admin`, delete branch, continue off fresh main |
| Removes-list | Listing removed exports forces intentionality | Gate fails if a PR removes an exported symbol without a `removes:` entry |
| Tombstones | Retire docs, plans, ADRs without losing trail | Prepend a 🪦 status block; keep the body |
| Audit trail | Every privileged operation produces a signed ledger entry | See security pillar |
| Verify-first close | Before fixing an issue, verify it's still open and not solved concurrently | `gh issue view \<n\> --json state` at session start and again before push |

## Non-negotiables

1. **No silent deletions.** Removing another author's exported symbol requires a `removes:` entry + justification in PR intent.
2. **Decisions are written, not announced.** ADR or RFC; see architecture pillar.
3. **Tombstone, do not delete.** Trail beats clean.
4. **Verify before fixing.** Concurrent agents may have closed the issue already.
5. **One PR = one sub-unit.** No "while I'm here" expansions.

## See also

- [`../architecture/adr-pattern.md`](../architecture/adr-pattern.md), [`../architecture/rfc-pattern.md`](../architecture/rfc-pattern.md)
- [`../ai-collaboration/README.md`](../ai-collaboration/README.md) — agent-side discipline for these rules.
- [`../../templates/PR-intent.template.md`](../../templates/PR-intent.template.md) — the manifest skeleton.

## Roadmap

- `universal.md`
- `pr-intent-pattern.md`
- `merge-rules-pattern.md`
- `tombstone-pattern.md`
- `phased-pr-pattern.md`
