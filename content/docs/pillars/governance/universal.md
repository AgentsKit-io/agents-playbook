---
title: 'Governance — Universal Principles'
description: 'How multiple contributors — agents and humans — coordinate so the whole sums.'
---

# Governance — Universal Principles

How multiple contributors — agents and humans — coordinate so the whole sums.

## TL;DR (human)

Eight rules. They make multi-author work additive instead of subtractive. Without them, the second agent silently undoes the first agent's work; the third reviewer cannot tell what changed; the fourth release ships a regression that "no one merged".

1. Every PR declares intent up front.
2. Merges sum work — removing peer work needs explicit justification.
3. Decisions are documented (ADR / RFC) before they ship.
4. Tombstone retired work; never silently delete.
5. One sub-unit per PR; one PR per session.
6. Verify-first close — confirm the issue is still open before "fixing" it.
7. Concurrent agents notice each other (search, fetch, check state).
8. Phased work ships in a chain; each phase is independently complete.

## For agents

### Rule 1 — Every PR declares intent up front

Each PR has a manifest in the description (or a `pr-intent.yaml` file in the diff). The manifest lists:

- `summary` — one sentence.
- `adds` — new exported symbols, new files.
- `changes` — existing symbols whose behavior changed.
- `removes` — symbols / files deleted.
- `tests` — tests added / updated.
- `docs` — docs added / updated.
- `gates` — gates expected to be green.

A gate parses the manifest and verifies it against the diff. Mismatch fails the PR.

Template: [`../../templates/PR-intent.template.md`](/docs/templates/PR-intent.template).

**Failure mode prevented:** PRs whose description does not match the diff; reviewers approving claims that the diff contradicts; agents quietly expanding scope mid-session.

### Rule 2 — Merges sum work — removing peer work needs explicit justification

Two specific protections:

1. **`removes:` is mandatory.** If your diff deletes an exported symbol you did not author, the manifest must include a `removes:` entry with a justification (why this is safe; what replaces it).
2. **`merge-override:` for `--theirs`/`--ours`.** If you used those flags to resolve a conflict, the manifest must include a `merge-override:` entry explaining why dropping one side was correct.

The gate fails the PR if either is missing when the diff calls for it.

**Failure mode prevented:** agents silently dropping peer work during conflict resolution; agents deleting "obsolete" code that turns out to be used by another package.

### Rule 3 — Decisions are documented (ADR / RFC) before they ship

Architecture changes → ADR. Breaking-contract changes → RFC.

The doc IS the change. The code implements the doc. A PR that ships architecture without a referenced ADR is incomplete.

Cross-cutting reference: [`../architecture/adr-pattern.md`](/docs/pillars/architecture/adr-pattern), [`../architecture/rfc-pattern.md`](/docs/pillars/architecture/rfc-pattern).

**Failure mode prevented:** rules that "everyone knows" but no one can cite; future agents reverting decisions because they cannot find the rationale.

### Rule 4 — Tombstone, never silently delete

When a doc / plan / ADR / screen / package is retired:

1. Prepend a tombstone block:

   ```markdown
   > 🪦 **TOMBSTONED \<YYYY-MM-DD\>** — superseded by [\<link\>](./...). Kept for trail.
   ```

2. Keep the body.
3. Update the back-references (index pages) to mark it retired without removing the link.

Why: the doc / decision / plan is part of the historical record. Future agents may need to understand why it existed and why it was retired. Deletion loses both.

**Exception:** purely generated artefacts (build outputs, CI reports). Tombstone source-of-truth content, not build artefacts.

**Failure mode prevented:** retired plans re-discovered six months later because no one knows they were retired; conflicting docs because the old version was deleted instead of marked.

### Rule 5 — One sub-unit per PR

A sub-unit is one discrete, shippable change.

- Cross-cutting refactor → split into one PR per affected package, chained.
- "While I'm here" expansions → split into a follow-up PR.
- A bug fix bundled with a refactor → split.

The reviewer must be able to read the PR end-to-end and understand the intent in one sitting. If they cannot, the PR is too big.

**Failure mode prevented:** PRs that combine unrelated changes; reviewers approving a refactor along with a bug fix without verifying both; subsequent agents reverting half the PR because they only understood the other half.

### Rule 6 — Verify-first close

Before "closing" an issue:

1. `gh issue view \<n\> --json state` — is it still open?
2. Re-read the issue's DoD. Did your work meet it?
3. Look at peer-closed PRs referencing the same issue. Did someone close it concurrently?

This was the single highest-yield governance discipline in production multi-agent work — agents repeatedly grinding on already-closed issues.

**Failure mode prevented:** dup PRs that get rejected; agents claiming "fixed" issues they did not actually meet the DoD for.

### Rule 7 — Concurrent agents notice each other

Before starting work in a path:

- `gh pr list --search "is:open \<path-fragment\>"` — are peer PRs touching this?
- `git log origin/main..HEAD --name-only` — what has main changed since you forked?
- Read peer PR descriptions. You may be redundant.

This is **search, not coordination**. The agents do not have to talk; the repo records who is doing what.

See [`../ai-collaboration/concurrent-agent-pattern.md`](/docs/pillars/ai-collaboration/concurrent-agent-pattern) for the full defensive checklist.

**Failure mode prevented:** two agents producing two PRs for the same fix; conflict storms at merge time; agents reverting each other's work in successive PRs.

### Rule 8 — Phased work ships in a chain

Big initiatives are too large for one PR. Split into phases:

- Each phase is independently shippable (passes gates, is reviewable).
- Each phase is merged with `--admin` (after gates pass) before the next phase opens.
- The next phase forks from fresh `main`, not from the previous phase's branch.
- A tracker issue lists all phases with their status.

Why merge before opening the next phase: keeping a chain of N open PRs causes catastrophic conflicts as main moves. One-at-a-time costs slightly more wall-clock; saves enormously in conflict resolution.

**Failure mode prevented:** mega-PRs that cannot be reviewed; long-lived branches that conflict catastrophically with main; "phase 2 PR" that no longer applies cleanly because the assumptions of phase 1 changed.

## See also

- [`../../templates/PR-intent.template.md`](/docs/templates/PR-intent.template)
- [`pr-intent-pattern.md`](/docs/pillars/governance/pr-intent-pattern), [`merge-rules-pattern.md`](/docs/pillars/governance/merge-rules-pattern), [`tombstone-pattern.md`](/docs/pillars/governance/tombstone-pattern), [`phased-pr-pattern.md`](/docs/pillars/governance/phased-pr-pattern)
- [`../ai-collaboration/concurrent-agent-pattern.md`](/docs/pillars/ai-collaboration/concurrent-agent-pattern)
- [`../architecture/adr-pattern.md`](/docs/pillars/architecture/adr-pattern), [`../architecture/rfc-pattern.md`](/docs/pillars/architecture/rfc-pattern)
