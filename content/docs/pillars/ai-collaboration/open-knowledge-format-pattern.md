---
type: Playbook Pattern
title: 'Open Knowledge Format Pattern'
description: 'Represent agent-readable knowledge as a directory of markdown + YAML frontmatter — the OKF open standard, and how it formalizes patterns this playbook already uses.'
---

# Open Knowledge Format Pattern

Represent agent-readable knowledge as a directory of markdown + YAML frontmatter — the OKF open standard, and how it formalizes patterns this playbook already uses.

## TL;DR (human)

The **Open Knowledge Format (OKF)** is a vendor-neutral open standard (published by Google Cloud, v0.1, June 2026) for sharing curated knowledge with both humans and agents. A bundle is just *a directory of markdown files with YAML frontmatter* — one concept per file, `type` as the only required field, `index.md` for navigation, normal markdown links forming a graph. No SDK, no runtime, no proprietary catalog. If your team already keeps an `AGENTS.md` repo or a `memory/` folder of one-fact-per-file notes, you are most of the way to an OKF bundle — adopting it mostly means agreeing on the conventions so *different* agents can read *your* knowledge without translation.

## For agents

### What OKF is

OKF formalizes the "knowledge as a living wiki of markdown, curated like code, read and updated by agents" pattern into a portable spec. The whole format:

- **A bundle is a directory of markdown files.** Just files — shippable as a tarball, hosted in git, mounted on any filesystem, rendered on GitHub.
- **File path = concept identity.** One concept per file.
- **YAML frontmatter** carries the small set of structured, queryable fields. **`type` is the only required field.** Standard optional fields: `title`, `description`, `resource` (a URL to the real thing), `tags`, `timestamp`.
- **`index.md`** in a directory gives agents progressive disclosure as they navigate the hierarchy.
- **`log.md`** (optional) holds a chronological history of changes.
- **Cross-links are normal markdown links** (`[customers](/tables/customers.md)`), turning the directory into a *graph* richer than the file tree.

```yaml
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?...
tags: [sales, revenue]
timestamp: 2026-05-28T14:30:00Z
---

# Schema
| Column | Type | Description |
|--------|------|-------------|
| `order_id` | STRING | Globally unique order identifier. |
```

That is the entire format: just markdown, just files, just YAML frontmatter.

### Why it matters

The problem OKF targets: the knowledge an agent needs is scattered across proprietary catalogs, wikis, drives, docstrings, and people's heads, and every vendor reinvents the same catalog + schema + SDK behind a lock-in boundary. A *format* (not a platform) lets knowledge written by one producer be consumed by any agent — yours today, a different one next year, a partner org's after that — with no translation layer. The value comes from how many parties speak it, not who owns it.

### Where this playbook already lives the pattern

OKF explicitly names the conventions this playbook is built on as prior art — `AGENTS.md` / `CLAUDE.md` files, repos with `index.md` that agents consult before work, "metadata as code". Several existing patterns are OKF-shaped:

- [`memory-pattern.md`](/docs/pillars/ai-collaboration/memory-pattern) — *one fact per file* + a `MEMORY.md` index is an OKF bundle in miniature. Give each memory file a `type` and it *is* one.
- [`bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) + [`agent-compatibility-pattern.md`](/docs/pillars/ai-collaboration/agent-compatibility-pattern) — the bootstrap doc is the entry point OKF's `index.md` plays for a knowledge bundle.
- [`self-describe-pattern.md`](/docs/pillars/ai-collaboration/self-describe-pattern) — the *complement*: OKF carries the **knowledge** (what things mean), the self-describe manifest carries the **capabilities** (what the system can do). Ship both.

This site is itself published as an OKF-aligned bundle: every doc carries a `type` in frontmatter, each directory has an `index.md`, docs cross-link into a graph, and the raw markdown is served at `/raw/<path>.md` plus a one-file `/llms-full.txt`. An agent can consume the playbook as knowledge without scraping the HTML.

### How to adopt it

1. **Put knowledge in markdown files, one concept per file**, in a git repo next to the code it describes. Curate it like code (PRs, review).
2. **Add `type` to every file's frontmatter** — the one required field. Pick a small, consistent vocabulary for your domain (`Service`, `Runbook`, `Dataset`, `Decision`, `Pattern`…).
3. **Add an `index.md` per directory** so agents can navigate top-down instead of loading everything.
4. **Link concepts with plain markdown links** — let the graph emerge; don't build a separate ontology.
5. **Use the optional fields where they earn their keep** — `tags` for retrieval, `resource` to point at the real artifact, `timestamp` for freshness, `log.md` for history.
6. **Let agents do the drudgery.** Agents read and update their own knowledge files; humans curate and review. An agent can touch fifteen cross-references in one pass without forgetting one.

Keep it minimal: only `type` is mandatory, producers define their own types and fields. Don't gold-plate a schema before the knowledge exists.

### Adopt it when

- Multiple agents (or multiple tools) need the same curated knowledge and you don't want a translation layer per tool.
- Knowledge currently lives in a proprietary catalog/wiki and you want it portable and version-controlled.
- You already keep `AGENTS.md` / a `memory/` folder and want it to be machine-consumable by *other* agents, not just yours.

Skip it when the knowledge is tiny, single-consumer, and already adjacent to the code (a `type` on a lone `AGENTS.md` buys little).

### Common failure modes

- **Reinventing a proprietary catalog.** A bespoke schema + SDK re-creates the lock-in OKF removes. → Use plain markdown + frontmatter; only `type` is required.
- **Hand-maintained knowledge that drifts from reality.** Stale wikis are worse than none. → Curate like code; let agents update files in the same PR as the change, and review it.
- **Over-specifying the schema up front.** A 30-field frontmatter nobody fills in. → Start with `type` + `title` + `description`; add fields when a consumer actually queries them.
- **Confusing knowledge with capability.** Dumping API/tool definitions into the knowledge bundle. → Knowledge (OKF) and capability (self-describe manifest) are different artifacts; keep them separate.
- **Trusting a static convention table.** Tool/standard details drift. → OKF is versioned and still v0.1; verify the current spec against its repository before relying on edge details.

### See also

- [`memory-pattern.md`](/docs/pillars/ai-collaboration/memory-pattern) — one-fact-per-file memory is a miniature OKF bundle.
- [`self-describe-pattern.md`](/docs/pillars/ai-collaboration/self-describe-pattern) — the capability complement to OKF's knowledge.
- [`agent-compatibility-pattern.md`](/docs/pillars/ai-collaboration/agent-compatibility-pattern) — one knowledge source, every agent.
- [`bootstrap-doc-pattern.md`](/docs/pillars/ai-collaboration/bootstrap-doc-pattern) — the bundle's entry point.
- OKF spec — `github.com/GoogleCloudPlatform/knowledge-catalog` (`/okf`).
