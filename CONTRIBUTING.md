# Contributing to agents-playbook

This playbook only accepts patterns earned in production. Theory is welcome only as the *rationale* for a rule that already paid off in a shipped repo.

## Submission rules

1. **Source the lesson.** Every new rule, gate, or prompt pattern must cite a concrete failure mode it prevents. Link to the originating ADR/RFC/issue/PR where possible.
2. **Dual-mode.** Every doc has a `## TL;DR (human)` block and a `## For agents` block. The human block is prose; the agent block is structured (sections fixed, no marketing voice).
3. **Two scope levels.** Add the universal principle first. If a TypeScript-specific recipe makes it land cleanly, add it to `ts-concrete.md` or a `<topic>-pattern.md` sibling — never mix them in one file.
4. **No bare assertions.** Every "do this" comes with the failure mode it prevents and the gate that enforces it (or a note that the gate is missing).
5. **English only.** Maximum reach, best RAG retrieval. Translations live as forks.
6. **CC-BY-4.0.** By submitting, you license your contribution under the repo license.

## Doc shape

Use this skeleton for any new pillar/phase doc:

```markdown
# <Title>

## TL;DR (human)

One paragraph. What the rule is. Why it exists. What it prevents.

## For agents

### Rule

The rule in one sentence, imperative.

### Why

The failure mode this prevents. Cite originating evidence.

### How to apply

Numbered steps. Concrete. Copy-paste-ready when possible.

### Gate

How to enforce automatically. Link to `scripts/` if a reference impl exists.

### Escape hatch

When the rule does not apply (and how the escape is logged).

### See also

Cross-links to related pillars/phases/templates.
```

## Status discipline

When a pattern is no longer recommended, **tombstone it** — do not delete:

```markdown
> 🪦 **TOMBSTONED <date>** — superseded by [new pattern](./new.md). Kept for trail.
```

## Review

Two-reviewer rule: one human, one agent (the playbook's own [`prompts/code-review.md`](./prompts/code-review.md) when shipped). Both must approve.

## Out of scope

- Tool-specific tutorials ("how to use Cursor's tab key"). The playbook is tool-agnostic; cite tools as examples.
- Vendor pitches. No "use X SaaS for this".
- Untested patterns. If you have not run it in a shipped project, it is not ready.
