# PR Intent Pattern

The manifest that makes a PR's claims verifiable.

## TL;DR (human)

Every PR carries a structured manifest. The manifest says what the PR adds, changes, removes, tests, documents, and which gates it expects green. A gate parses the manifest and cross-checks the diff. The manifest IS the contract — the diff is the implementation.

## For agents

### Why a manifest

Without one:

- Reviewers read the PR description, scan the diff, and *hope* the two match.
- Renames look like delete-plus-add — peer work disappears silently.
- "Refactor" PRs grow to include behavior changes that get reviewed as if they were cosmetic.
- Quality gates that should run for a UI change skip because the PR was labeled `refactor`.

The manifest forces the agent to state the claim before opening review. The gate enforces the claim.

### Where the manifest lives

Two valid placements:

1. **Embedded YAML in PR description** (between `\`\`\`yaml ... \`\`\``). Simpler — no extra file. Gate parses the description body.
2. **`pr-intent.yaml` file in the diff** (typically at repo root, deleted-on-merge or `.gitignored`-on-merge). Lets the manifest survive review revisions cleanly.

Pick one. Mixing is worse than either.

### Manifest schema

Full template: [`../../templates/PR-intent.template.md`](../../templates/PR-intent.template.md). Required fields:

```yaml
intent:
  summary: "One sentence imperative voice"
  pillar: architecture | security | ui-ux | quality | governance | ai-collaboration
  phase: discover | design | build | test | ship | operate
  sub-unit: "<issue#> · <slug>"
  type: feat | fix | refactor | docs | test | chore | adr | rfc

adds:
  - "<symbol or file>"

changes:
  - "<symbol or file> — <one-line description>"

removes:
  - symbol: "<name>"
    justification: "<why safe; what replaces it>"

tests:
  - "<test file or name>"

docs:
  - "<doc file>"

gates:
  - lint
  - typecheck
  - unit
  - structural
  - "<extra gate triggered by this change>"
```

### Gate checks

Reference impl: [`../../scripts/check-pr-intent.example.mjs`](../../scripts/check-pr-intent.example.mjs).

The gate enforces:

1. **Well-formed.** Parse fails → PR fails.
2. **All required fields present.**
3. **`removes:` matches diff.** Every exported-symbol deletion in the diff is listed. Every listed removal exists in the diff.
4. **`adds:` matches diff.** Every new exported symbol is listed.
5. **`gates:` are all green.** If `gates:` lists `structural` and the structural gate failed, the PR fails.
6. **Sub-unit references a real issue.** `gh issue view <n>` returns; state is `open` (or `closed` if this PR is the closer).
7. **`type:` matches change pattern.** A PR typed `docs` that modifies `src/**/*.ts` fails — type mismatch.

### Reviewer workflow

The reviewer:

1. Reads the manifest. Understands the claim.
2. Reads the diff. Confirms it matches the claim.
3. Reads the tests. Confirms they cover the claim.
4. Reads the docs. Confirms they reflect the claim.

If the diff does something the manifest does not claim, the diff is wrong **or** the manifest is wrong. Either way, the PR is not yet ready.

### Common failure modes

- **`removes:` empty when diff deletes peer-authored symbols.** Silent revert. → Gate detects exported-symbol removals against `git blame`; requires manifest entry.
- **`summary` is marketing copy.** "Improve user experience" — not actionable. → Lint summary for verbs: `add | fix | refactor | rename | remove | document | test`.
- **Renames as delete + add.** Looks like a remove + add; in fact it's a rename. → Gate detects similar-content pairs and asks: rename or genuine removal?
- **`gates: []` (skipped).** Agent disables gates to merge faster. → Gate config has a hard-coded minimum set that cannot be removed.
- **`sub-unit` lists multiple issues.** PR is doing too much. → Gate requires exactly one entry.

### Adoption path

If your repo does not have manifests yet:

1. Write the template. Land it in `templates/`.
2. Make manifests *optional* for two weeks. Agents practice; reviewers learn the shape.
3. Make manifests *required* (gate fails without one) — for new PRs only.
4. After one month, make the cross-check (manifest-vs-diff) mandatory.
5. After two months, add the `removes:` enforcement.

Graduated adoption prevents the gate from becoming a blocker before the team has the muscle to honor it.

### See also

- [`universal.md`](./universal.md) — Rule 1.
- [`merge-rules-pattern.md`](./merge-rules-pattern.md) — `merge-override:` annotation.
- [`../../templates/PR-intent.template.md`](../../templates/PR-intent.template.md).
- [`../../scripts/README.md`](../../scripts/README.md) — gate reference impl.
