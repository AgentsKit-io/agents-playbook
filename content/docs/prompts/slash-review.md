---
title: 'Slash Command — /review'
description: 'Multi-agent code review pass on a PR (or current branch).'
---

# Slash Command — /review

Multi-agent code review pass on a PR (or current branch).

## Trigger

```
/review [<pr#>]
```

- `/review` — reviews the current branch's diff against main.
- `/review 1234` — reviews PR #1234.

## Body

```
Run a multi-agent code review.

Process:

1. CONTEXT
   - If pr# given: fetch the PR description, intent manifest, linked issues.
   - Else: derive diff from `git diff origin/main..HEAD`.
   - Read CLAUDE.md / AGENTS.md.

2. PRE-CHECKS (orchestrator, fast)
   - Manifest present? If not: BLOCKING.
   - Intent claims match diff? (run check-pr-intent gate)
   - Gates green on the branch? (run `pnpm check:quality-gates`)

3. SPAWN SUB-AGENTS IN PARALLEL
   - `subagent-code-reviewer` — general review pass.
   - `subagent-code-reviewer` with security focus, OR a dedicated security review using `system-security` system prompt — if the diff touches auth / vault / audit / egress / sandbox.
   - `subagent-explore` — verify-first close: is the linked issue still open? Are peers touching same paths?

4. AGGREGATE
   - Merge findings; deduplicate.
   - Sort by severity, then confidence.
   - Drop findings < 0.6 confidence.

5. OUTPUT
   ## Verdict
   BLOCKING | APPROVE-WITH-CHANGES | APPROVE.

   ## Pre-checks
   - Manifest: present | missing
   - Intent vs diff: match | mismatch (details)
   - Gates: green | red (details)
   - Concurrent agents: clear | conflict (details)
   - Linked issue: open | closed (concern: dup PR)

   ## Findings (sectioned by severity)
   per finding: file:line + problem + suggested fix.

   ## Nits

   ## Praise (max 3 lines)

6. ON BLOCKING
   - Do NOT merge.
   - Surface the verdict to the user.
   - Suggest the smallest set of changes that would flip to APPROVE.

7. ON APPROVE
   - State the verdict.
   - DO NOT auto-merge unless the user explicitly approved merging in this session.
   - "/review" produces a verdict; merging is a separate, confirmed action.

Honesty:
- If the diff is too big to review well in one pass, say so. Recommend phase split.
- If you skipped a check, say so.
- No optimistic verdict.
```

## Common failure modes

- **`/review` auto-merges.** Side-effect without confirmation. → Body's Rule 7 separates verdict from merge.
- **Reviews dump every nit; reviewer drowns.** → Confidence ≥ 0.6 filter.
- **Reviews skip security on touchy diffs.** → Body's Rule 3 mandates security pass on sensitive paths.

## See also

- [`subagent-code-reviewer.md`](./subagent-code-reviewer.md)
- [`system-reviewer.md`](./system-reviewer.md)
- [`system-security.md`](./system-security.md)
- [`../pillars/governance/pr-intent-pattern.md`](../pillars/governance/pr-intent-pattern.md)
