# Anti-Overengineering

How to keep agents (and engineers) from building three layers of abstraction for what would have been ten lines of code.

## TL;DR (human)

Agents over-abstract by default — interfaces around single implementations, generic registries for two callers, plugin systems for a known-fixed set. The discipline is **YAGNI** enforced by complexity budgets: cyclomatic complexity per function, dependency-depth per module, abstraction count per package. Code that "might be needed someday" almost never is; when it is, you add it then.

## For agents

### The default failure mode

Faced with a task, an agent's default reach is to abstract. Three patterns recur:

1. **Interface for one implementation.** A class with a single constructor → wrapped in an interface "in case we add another". The interface adds nothing; readers click through it for nothing.
2. **Generic for two callers.** Two call sites with subtle differences → a generic helper with a config object. The config object grows; the function becomes harder to read than the two originals.
3. **Plugin system for a known set.** Three known integrations → an extensible plugin loader. The loader is more code than the three integrations combined.

None of these are wrong in principle. They are wrong when the abstraction does not yet pay for itself.

### YAGNI test

Before adding any of:

- Interface / abstract base class.
- Generic helper.
- Plugin / registry / strategy pattern.
- Configuration option.
- Indirection (manager / coordinator / orchestrator).

Ask:

1. **Do I have two real, current call sites?** Not "I can imagine two". Two concrete sites in code today.
2. **Do the two sites diverge in ways the abstraction would unify?** If they happen to share shape but their concerns are different, abstracting couples them.
3. **Is the abstraction smaller than the duplication it removes?** If the abstraction is bigger, it's overhead.

If any answer is no: do not abstract yet. Inline the second call. When a third call appears, revisit.

### Complexity budgets

Hard caps, enforced by a gate:

| Metric | Budget |
|---|---|
| Cyclomatic complexity per function | ≤ 14 |
| Function length | ≤ 60 lines |
| Parameter count per function | ≤ 5 |
| Class member count | ≤ 15 (often signals the class is doing too much) |
| Module export count | ≤ 20 (more = split the module) |
| Dependency depth (a calls b calls c calls d...) | ≤ 6 |
| `extends` chains | ≤ 2 |

When a budget breaks, the answer is **simplification, not increase the budget**.

### Patterns that recur as over-engineering

| Pattern | Symptom | When it's earned | When it's overhead |
|---|---|---|---|
| Repository pattern | `UserRepository` wrapping ORM | Multiple persistence backends | One DB, one ORM, no churn — use the ORM directly |
| Service layer | `UserService` calling `UserRepository` | Cross-store transactions | CRUD-only, no business logic |
| DTO mapping | `UserDTO ↔ UserModel ↔ UserEntity` | API and DB shapes diverge | They have the same fields |
| Factory | `UserFactory.create()` | Construction logic is non-trivial | Just `new User(args)` |
| Generic event bus | for 3 events | When event shape varies + decoupling needed | Direct call is clearer |
| Config object | 8-field `{...opts}` | Many call sites with diverse needs | One caller; positional args fine |
| Custom hook for one call | `useCount()` wraps `useState` | Reused logic ≥ 3 sites | Inline `useState` |
| Wrapper component for one prop | `<Card variant="primary">` is a `\<div\>` with `class` | Variants justify it | Direct className |
| Indirection through manager | `WidgetManager.create(WidgetSpec)` for two widgets | Plugin ecosystem | Static dispatch |

### "Premature optimization is the root of all evil" — and its corollary

The famous line. The corollary, less quoted: **premature flexibility is more expensive than premature optimization**, because optimization can be torn out, but flexibility breeds usage that locks the shape in.

Apply the same skepticism to "extension points" as to "fast paths". Add when needed. Inline when not.

### Signs the codebase is over-engineered

- Reading a function requires following 4+ indirections to find what it actually does.
- A bug fix requires editing files in 3+ layers.
- New developer onboarding takes 3+ days to "understand the architecture".
- "Where do I add X?" has multiple plausible answers.
- The configuration documentation is longer than the implementation.
- Pull requests are mostly plumbing changes.

### Refactor in the simplify direction

When you find over-engineered code:

1. Inline a layer at a time. Measure: does each inline make the call site harder or easier to read?
2. Stop inlining when each step starts to hurt readability.
3. The final shape is often shallower than the original by 2–3 layers.

This is the opposite of the usual refactor direction. Both are valid moves; agents tend to only know one.

### Gate (optional)

A complexity-budget gate (similar to file-size) tracks:

- Cyclomatic complexity per function (use `complexity` ESLint rule).
- Function length.
- Module export count.

Shrink-only baseline. New functions / modules respect the budgets; existing offenders cannot grow.

Reference impl shape: parse with `@typescript-eslint/parser`, walk function nodes, measure, compare to baseline.

### Common failure modes

- **Building "platform" before product.** Six months on a plugin loader; no plugins yet. → Ship product; carve out platform when 3+ plugins force the shape.
- **Adding a config option per request.** Three options become twenty; nothing uses combination N. → Defaults are the contract; options are for real, recurring needs.
- **Abstraction with one implementation.** The interface exists "for future flexibility". → Delete the interface; use the class directly.
- **Future-proofing for problems that never arrive.** "We'll need to support 10 databases someday." → Support the one you use now; design the boundary so adding the second is one PR.
- **Architecture astronaut review comments.** "What if we wanted to..." → Reviewer should suggest the simpler option, not the more elaborate one.

### When to actually abstract

These are real signals:

- Three or more current callers with shared concerns.
- The thing being abstracted is changing for reasons the callers should not care about.
- The duplication is across files that change together for the wrong reason (the change scattered).
- A test forces an abstraction (the test can only run if a seam exists).

When at least two of these hold, abstract. Otherwise, inline + wait.

### Anti-overengineering as a culture

This pillar fights against agent default reach. Reinforce by:

- Reviewer prompt explicitly asks "could this be simpler?".
- The `system-implementer` prompt forbids speculative abstraction.
- Code review praises inlined, direct code.
- Reading group on classics (John Carmack's inlined-code essay, Casey Muratori on hierarchies).

### See also

- [`file-size-budget.md`](./file-size-budget.md) — size budget complements complexity budget.
- [`universal.md`](./universal.md) — Rule 1 names every boundary; named boundaries do not need wrappers.
- [`../quality/test-pyramid.md`](../quality/test-pyramid.md) — over-abstracted code is harder to test.
