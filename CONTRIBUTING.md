# Contributing to agents-playbook

This playbook only accepts patterns earned in production. Theory is welcome only as the *rationale* for a rule that already paid off in a shipped repo.

Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md) and
[project governance](./GOVERNANCE.md). Report vulnerabilities through
[SECURITY.md](./SECURITY.md), never in a public issue. Do not submit secrets,
credentials, private customer information, or confidential repository details.

## Submission rules

1. **Source the lesson.** Every new rule, gate, or prompt pattern must cite a concrete failure mode it prevents. Link to the originating ADR/RFC/issue/PR where possible.
2. **Dual-mode.** Every doc has a `## TL;DR (human)` block and a `## For agents` block. The human block is prose; the agent block is structured (sections fixed, no marketing voice).
3. **Two scope levels.** Add the universal principle first. If a TypeScript-specific recipe makes it land cleanly, add it to [`ts-concrete.md`](./content/docs/pillars/architecture/ts-concrete.md) or a `<topic>-pattern.md` sibling — never mix them in one file.
4. **No bare assertions.** Every "do this" comes with the failure mode it prevents and the gate that enforces it (or a note that the gate is missing).
5. **English only.** Maximum reach, best RAG retrieval. Translations live as forks.
6. **Respect the license boundary.** Software contributions are licensed under
   [MIT](./LICENSE). Written patterns, prompts, templates, illustrations, and
   other editorial content are licensed under
   [CC BY 4.0](./LICENSE-CONTENT). By submitting a contribution, you agree that
   it is distributed under the license applicable to the files you change.

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

How to enforce automatically. Link to `content/docs/scripts/` if a reference impl exists.

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

Two-reviewer rule: one human, one agent (for example the playbook's own [code reviewer prompt](./content/docs/prompts/subagent-code-reviewer.md)). Both must approve.

## Out of scope

- Tool-specific tutorials ("how to use Cursor's tab key"). The playbook is tool-agnostic; cite tools as examples.
- Vendor pitches. No "use X SaaS for this".
- Untested patterns. If you have not run it in a shipped project, it is not ready.

## Ecosystem conformance

`pnpm conformance` runs the cross-ecosystem contracts locally and prints criterion-level JSON evidence (`--out <file>` also writes it). Checks: lifecycle (shared `@agentskit/chat/protocol/fixtures` decoded by the `@agentskit/chat/protocol` decoder, in a bounded child), redaction (secrets gate), clean consumer (`test:onboarding`), and Doc Bridge/harness documentation checks.

- Bounds: 180 s per criterion, 600 s total, one direct child process at a time (vitest and pnpm subprocesses spawned by a criterion are not capped individually), 512 MB heap per Node child, 64 KiB captured output. Network is offline on a best-effort basis (offline flags and a dead proxy); it is not a sandbox.
- Fails closed: a failed, timed-out, or unsupported criterion exits non-zero (`--allow-unsupported` exits 0 when the only non-passing criteria are unsupported; they stay listed under `unsupported`).
- Unsupported today: `lifecycle-cancellation` (`@agentskit/chat` publishes no cancellation fixture) and `trust-boundary-evidence` (AgentsKit publishes no shared boundary evidence contract). Only the local `redaction` secrets gate covers the trust boundary meanwhile. Each becomes a real criterion once the upstream fixture/contract exists.
- Side effect: the `doc-bridge-index` criterion regenerates the Doc Bridge index and `doc-bridge.config.json`, so the working tree may change after a run.
