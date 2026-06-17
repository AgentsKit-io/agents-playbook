---
type: Playbook Pattern
title: 'Fail-Loud Defaults Pattern'
description: 'Why a silent no-op default plus a test harness that overrides it lets broken production wiring pass CI green.'
---

# Fail-Loud Defaults Pattern

Why a silent no-op default plus a test harness that overrides it lets broken production wiring pass CI green.

## TL;DR (human)

A dependency that defaults to a harmless no-op when nothing wires it up is convenient — and dangerous. If the test harness *always* registers a real implementation, the tests never exercise the no-op, so a missing production binding ships green and breaks only in the deployed app. Either make the unwired default fail loudly, or add an integration test that asserts the real binding is present in the path users actually run.

## For agents

### The trap

A common injectable-dependency shape:

```ts
// translation hook, dependency-injected
let useT: TranslateHook = (key) => key; // default no-op: returns the raw key

export function registerUseT(hook: TranslateHook) { useT = hook; }
```

The default is a silent fallback. In production, some bootstrap is supposed to call `registerUseT(realHook)`. If that call is missing — say a new screen's bridge was never wired — the UI renders raw keys (`inbox.title` instead of "Inbox"). The bug is real and user-visible.

Now the test setup:

```ts
// test-setup.ts — runs before every test
registerUseT((key) => translations[key] ?? key);
```

The harness *always* installs a real hook. So **every test passes**, the no-op default is never exercised in CI, and the missing production wiring is invisible until someone opens the deployed app. Green build, broken product.

### Why this class is sneaky

- The no-op is "safe" — it doesn't throw, so nothing alarms.
- The test environment is *more* wired than production, so tests are strictly easier than reality.
- Coverage looks fine: the registration path and the hook both run — just not the unwired branch that ships.

The same shape recurs with default loggers that swallow, default feature-flag providers that return `false`, default metrics sinks that drop, default auth resolvers that allow. Anywhere a default quietly substitutes for missing wiring, CI can pass while production is wrong.

### Fixes

**Option A — fail loud when unwired.** If the dependency is mandatory in production, the default should make noise, not absorb it:

```ts
let useT: TranslateHook | null = null;
export function registerUseT(hook: TranslateHook) { useT = hook; }
export function t(key: string) {
  if (!useT) throw new Error("useT not registered — wire registerUseT() at bootstrap");
  return useT(key);
}
```

Now a missing binding fails immediately, and a test that forgets to register also fails — surfacing the requirement.

**Option B — assert the real binding in an integration test.** If a silent default must stay (genuinely optional dependency), add a test that exercises the *actual production bootstrap* and asserts the real implementation is installed — not a test-only one:

```ts
test("production bootstrap wires every screen's translate hook", () => {
  mountRealAppProviders();           // the real bootstrap, not test-setup's shortcut
  expect(translateHookIsRegistered()).toBe(true);
});
```

The principle: **the test environment must not be strictly more wired than production.** If the harness installs something production might lack, you have no test for the lack.

### Detection heuristics

- Grep for default implementations that return the input unchanged, return a constant, or do nothing (`= (x) => x`, `= () => false`, `= () => {}`).
- For each, ask: *what happens if nobody overrides this in production?* If the answer is "a silent wrong result", it needs Option A or B.
- Check whether the test setup globally registers a real version. If so, the no-op branch has zero real coverage.

### Common failure modes

- **No-op default + harness always overrides it.** Missing wiring ships green. → Fail loud, or assert the real binding.
- **"It's covered" because the hook runs in tests.** The *unwired* branch is what ships, and it's untested. → Test the production bootstrap path.
- **Default that silently allows / returns false / drops.** Security and correctness regressions hide behind a calm default. → Mandatory deps fail loud when absent.
- **Test environment more wired than prod.** Tests are easier than reality. → Keep the harness honest; exercise the real bootstrap somewhere.

### See also

- [`contract-testing-pattern.md`](/docs/pillars/quality/contract-testing-pattern) — verifying real wiring across a boundary.
- [`mutation-testing-pattern.md`](/docs/pillars/quality/mutation-testing-pattern) — surfaces assertions that never fire.
- [`../ai-collaboration/verify-first-pattern.md`](/docs/pillars/ai-collaboration/verify-first-pattern) — green CI is not proof the deployed path works.
