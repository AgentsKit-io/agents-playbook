---
type: Playbook Pattern
title: 'Agent Compatibility Pattern'
description: 'One playbook, every agent — how to map the bootstrap-doc convention onto Claude Code, Cursor, Windsurf, Copilot, Codex, and the rest.'
---

# Agent Compatibility Pattern

One playbook, every agent — how to map the bootstrap-doc convention onto Claude Code, Cursor, Windsurf, Copilot, Codex, and the rest.

## TL;DR (human)

Every coding agent reads a **bootstrap doc** before it works — it just disagrees on the filename. The playbook's rules are tool-neutral; you adopt them by writing them into whatever file your agent already looks for. Pick one canonical source of truth (a root `AGENTS.md` is the most widely-read), and let the other tools' files point at it instead of duplicating. None of the patterns in this playbook are Claude-specific.

## For agents

### The bootstrap doc is universal; the filename is not

The [bootstrap-doc pattern](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) says: one file the agent reads first, holding non-negotiables + routing. That idea predates any single tool. What varies is only *where* each agent looks:

| Agent | Bootstrap file(s) it reads | Notes |
|---|---|---|
| Claude Code | `CLAUDE.md` (also reads `AGENTS.md`) | Nested `CLAUDE.md` per directory supported; `@import` of other files |
| Cursor | `.cursor/rules/*.mdc`, root `AGENTS.md` | One rule file per concern; legacy `.cursorrules` still read |
| Windsurf | `.windsurfrules`, `.windsurf/rules/` | Root-level project rules |
| GitHub Copilot | `.github/copilot-instructions.md` | Repo-wide custom instructions |
| OpenAI Codex / Codex CLI | `AGENTS.md` | Root-level; the de-facto cross-tool convention |
| Aider | `CONVENTIONS.md` (added to context) | Point it at the file explicitly |
| Cline / Roo | `.clinerules` | Root-level |
| Zed | `.rules` / assistant rules | Project rules file |
| Gemini CLI | `GEMINI.md` / `AGENTS.md` | Root-level |

Filenames drift; verify your tool's current convention rather than trusting this table blindly — confirm against the tool's live docs, not memory (see [`hallucination-reduction-pattern.md`](/docs/pillars/ai-collaboration/hallucination-reduction-pattern)).

### Single source of truth, thin adapters

Do not maintain nine divergent rule files. Pick one canonical doc — a root `AGENTS.md` is read by the most tools — and make the others thin pointers:

- `CLAUDE.md` → a one-line `See @AGENTS.md` (Claude Code resolves the import).
- `.cursor/rules/playbook.mdc` → a short rule that references `AGENTS.md`.
- `.github/copilot-instructions.md` → "Follow the conventions in `AGENTS.md`."

When the rules change, you edit one file. Divergent copies are how one agent follows a rule another silently violates.

### What's portable vs what isn't

**Portable across every agent** (the bulk of this playbook): architecture boundaries, security rules, quality gates, governance/PR discipline, the design-system rules, persistent memory as files, verify-first, honest reporting. These are engineering practices — the agent is incidental.

**Tool-specific mechanics** (translate, don't copy verbatim): slash commands, sub-agent/fan-out APIs, hooks, goal-mode loops, and context-window controls differ per tool. The *pattern* (e.g. "delegate long fan-outs to scoped sub-agents") is portable; the invocation syntax is not. Where a doc shows a concrete command, treat it as an example to adapt to your tool's equivalent.

### Capability fallbacks

Agents differ in what they can do. Degrade gracefully:

- **Can't fetch URLs?** Paste [`llms-full.txt`](/llms-full.txt) into context, or download the [zip bundle](/playbook-bundle.zip) and index it locally.
- **Small context window?** Use [`llms.txt`](/llms.txt) as a map and fetch only the relevant `/raw/<path>.md` docs.
- **No persistent memory feature?** The [memory pattern](/docs/pillars/ai-collaboration/memory-pattern) is just files in the repo — it works for any agent that can read the tree.
- **No sub-agent support?** Run the fan-out steps sequentially in one session.

### Common failure modes

- **Claude-only framing.** Rules written as "Claude must…" read as inapplicable to other tools. → Write tool-neutral ("the agent must…"); keep concrete commands as adaptable examples.
- **Nine divergent rule files.** Tools follow different rules; conflicts ship. → One canonical doc; the rest are pointers.
- **Assuming a filename.** You wrote `.cursorrules` but the tool now reads `.cursor/rules/`. → Verify the current convention.
- **Copying tool-specific syntax verbatim.** A Claude slash command pasted into another tool does nothing. → Translate the pattern to the tool's equivalent.

### See also

- [`bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) — what the bootstrap doc contains.
- [`../../onboard-your-agent.md`](/docs/onboard-your-agent) — the ready-to-paste prompt that trains any agent on the whole playbook.
- [`hallucination-reduction-pattern.md`](/docs/pillars/ai-collaboration/hallucination-reduction-pattern) — verify the current filename convention against live docs, don't trust a static list.
- [`memory-pattern.md`](/docs/pillars/ai-collaboration/memory-pattern) — file-based memory works for any agent.
