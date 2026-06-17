---
type: Playbook Pattern
title: 'Tool & Capability Design Pattern'
description: 'Design the abstraction layer between a model and your product — tools, file systems, artifacts, skills — so complex multi-step work feels natural to the model and stays reliable for users.'
---

# Tool & Capability Design Pattern

Design the abstraction layer between a model and your product — tools, file systems, artifacts, skills — so complex multi-step work feels natural to the model and stays reliable for users.

## TL;DR (human)

Tools are the model's API to your product, and the model is a *user* of that API with peculiar ergonomics: it reads the description as the spec, can't see your code, and fails differently than humans. Design tools at the altitude of user intent ("schedule a meeting"), not raw endpoints; make descriptions and schemas self-explanatory; constrain inputs so whole error classes are impossible; return results the model can act on (including good errors); keep the exposed toolset small and gated to the task; and treat skills/artifacts/file-systems as first-class abstractions that turn multi-step workflows into something the model can drive reliably. The tool surface is product design for a non-human user — and it determines reliability as much as the prompt.

## For agents

### A tool is an API whose user is a model

The model can't read your source. The **tool name, description, and schema are the entire contract** — they are prompt-engineering surface, not just type plumbing. A vague description or an ambiguous parameter is a bug that shows up as "the model keeps calling it wrong." Write tool specs the way you'd write docs for an external developer who only has the function signature — because that's exactly the situation.

### Design at the altitude of intent

Wrapping every REST endpoint 1:1 makes the model orchestrate plumbing — chaining six low-level calls, holding state, and failing in the middle. Instead, expose tools at the **granularity of what the user wants to accomplish**:

- `scheduleMeeting(attendees, window)` — not `listCalendars` + `getFreeBusy` + `createEvent` + `sendInvites` for the model to assemble.
- One tool = one coherent unit of intent the model can reason about atomically.
- Push multi-step orchestration *into* the tool where the steps are deterministic; leave the model to decide *which* intent, not to hand-assemble every primitive.

Higher altitude = fewer turns, less state for the model to drop, fewer places to fail.

### Make the contract self-explanatory and constrained

- **Names are semantic.** `searchCustomers` not `query2`. The name alone should imply when to call it.
- **Descriptions state when to use, when *not* to, and what comes back.** Include the failure shape. Disambiguate from sibling tools ("use this for X; for Y use `otherTool`").
- **Schema constrains the input space.** Enums over free strings, required fields explicit, value ranges encoded. A constrained schema makes a class of wrong calls *impossible* rather than merely discouraged — the strongest form of guidance (see [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern)).
- **Validate at the boundary and return a usable error.** Errors are part of the model's loop: a good error says what was wrong and how to fix the call, so the model self-corrects instead of looping. A raw stack trace is a dead end (see [`../architecture/error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy)).

### Return results the model can use

- **Shape output for consumption, not for humans.** Structured, concise, relevant. A tool that dumps 10k tokens of raw JSON blows the context budget and buries the signal (see [`context-management-pattern.md`](/docs/pillars/ai-collaboration/context-management-pattern)).
- **Reference large payloads by handle.** Write big artifacts to a file/store and return a reference; let the model pull what it needs. Don't pour a 50-page document into the window.
- **Be honest about partial success.** "Created 3 of 5, these 2 failed because…" beats a flat success/error the model can't reason about.

### Keep the toolset small and gated

Every tool definition spends context tokens and adds a choice the model can get wrong. Fifty tools in the window is noise, latency, and mis-selection.

- **Expose only the tools relevant to the current task/state.** Gate the set; reveal capabilities as the workflow reaches them.
- **Prune overlap.** Two tools that do almost the same thing guarantee the model sometimes picks the wrong one.
- **Authorize at call time regardless.** The toolset is ergonomics; permission is enforcement — the model offering a tool is never authorization to run it (see [`../security/ai-llm-safety-pattern.md`](/docs/pillars/security/ai-llm-safety-pattern)).

### File systems, artifacts & skills as first-class abstractions

The richest agent products give the model more than function calls — they give it an **environment**:

- **A file system / artifact store** lets the model produce, revise, and reference durable work products instead of regenerating everything inline. Artifacts are how multi-step output stays coherent across turns and how large results stay out of the context window (handle, not blob).
- **Skills** package a reusable capability — instructions + tools + context for a task class — that the model invokes as a unit. A skill turns "here are 12 primitives, figure it out each time" into "do this known thing well," which is the difference between brittle and reliable on complex workflows.
- **Design these as the abstraction layer between product and model:** the product exposes capabilities (files, artifacts, skills); the model composes them. Get this layer right and complex multi-step work *feels natural to the model and reliable to users* — get it wrong and the model improvises plumbing and drops state.

This abstraction layer is also exactly what you publish as a machine-readable surface so other agents can discover and drive it — see [`self-describe-pattern.md`](/docs/pillars/ai-collaboration/self-describe-pattern).

### Tools are versioned, tested, evaluated

A tool's description and schema are behavior — when you change them, re-run the evals (the model may now call it differently). Version tool definitions alongside prompts ([`prompt-versioning-pattern.md`](/docs/pillars/ai-collaboration/prompt-versioning-pattern)), and add tool-call assertions to the deterministic eval tier ([`../quality/agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern)): given input X, the right tool is called with the right args, and destructive tools are *not* called unbidden.

### Common failure modes

- **1:1 endpoint wrappers.** Model orchestrates plumbing, drops state mid-chain. → Design at the altitude of user intent.
- **Vague descriptions.** "The model keeps calling it wrong" — because the spec is the description. → Say when/when-not/returns; disambiguate siblings.
- **Free-string params that should be enums.** Invites invalid calls. → Constrain the schema so wrong calls are impossible.
- **Raw errors returned to the model.** Dead-end loops. → Actionable error: what's wrong + how to fix the call.
- **Tool dumps huge payloads inline.** Blows context, buries signal. → Reference by handle; shape output for consumption.
- **Fifty tools always exposed.** Noise, latency, mis-selection. → Gate to the task; prune overlap.
- **Tool change shipped without re-eval.** Model's calling behavior silently shifts. → Version + tool-call assertions in the suite.
- **Treating the toolset as authorization.** Offered ≠ allowed. → Enforce permission at call time.

### See also

- [`self-describe-pattern.md`](/docs/pillars/ai-collaboration/self-describe-pattern) — publish the capability surface for external agents.
- [`prompt-versioning-pattern.md`](/docs/pillars/ai-collaboration/prompt-versioning-pattern) — tool defs are versioned behavior.
- [`context-management-pattern.md`](/docs/pillars/ai-collaboration/context-management-pattern) — toolset size + result shape are context costs.
- [`../quality/agent-eval-framework-pattern.md`](/docs/pillars/quality/agent-eval-framework-pattern) — tool-call assertions as deterministic evals.
- [`../architecture/contracts-zod-pattern.md`](/docs/pillars/architecture/contracts-zod-pattern) — schemas that constrain tool input.
- [`../architecture/error-hierarchy.md`](/docs/pillars/architecture/error-hierarchy) — error shapes the model can act on.
- [`../security/ai-llm-safety-pattern.md`](/docs/pillars/security/ai-llm-safety-pattern) — tool authorization + injection defense.
