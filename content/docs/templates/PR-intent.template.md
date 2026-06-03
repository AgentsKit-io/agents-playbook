---
title: 'PR Intent Manifest'
description: 'Embed this block in every PR description. A gate parses it and verifies that the diff matches the claims.'
---

# PR Intent Manifest

Embed this block in every PR description. A gate parses it and verifies that the diff matches the claims.

```yaml
intent:
  summary: |
    One sentence: what this PR does. Imperative voice.
  pillar: architecture | security | ui-ux | quality | governance | ai-collaboration
  phase: discover | design | build | test | ship | operate
  sub-unit: <issue#> · <short slug>
  type: feat | fix | refactor | docs | test | chore | adr | rfc

adds:
  - <new exported symbol or new file>
  - …

changes:
  - <existing symbol whose behavior changed; describe the change>
  - …

removes:
  # Listing a removal is REQUIRED if you delete any exported symbol of another author,
  # or any public API. Include the justification (why this is safe).
  - symbol: <old name>
    justification: <why this removal is safe; what replaces it>

tests:
  - <test file or test name added/changed>
  - …

docs:
  - <doc file added/changed>
  - …

gates:
  # Which gates must be green for this PR. Defaults: lint, typecheck, unit, structural.
  # Add gates here if the PR touches a special surface.
  - lint
  - typecheck
  - unit
  - structural
  - <extra>

merge-override: <reason>   # OPTIONAL. Required if you used `git checkout --theirs/--ours`.
                           # Explain why the merge resolution dropped peer work.
```

## Rules

1. **No silent deletes.** If the diff removes an exported symbol you did not author, you must include a `removes:` entry. The gate fails otherwise.
2. **One sub-unit per PR.** If your PR has more than one issue in `sub-unit`, split it.
3. **`merge-override` is rare.** Default is to rebase and reconcile. Use only when a conflict cannot be resolved without dropping work, and document why.
4. **The intent block is the contract.** Reviewers verify the diff against the claims. The diff is wrong if it does not match.

## Gate

Reference impl: [`../scripts/check-pr-intent.example.mjs`](/docs/scripts).

The gate:

- Parses the YAML block from the PR description (or a `pr-intent.yaml` file in the diff).
- Crosses against the diff: every removed exported symbol must have a `removes:` entry; every added exported symbol must be in `adds:`.
- Fails on missing fields, malformed YAML, or claim-vs-diff mismatch.
