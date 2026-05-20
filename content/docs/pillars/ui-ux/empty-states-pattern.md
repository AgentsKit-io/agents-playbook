---
title: 'Empty States Pattern'
description: 'How to turn empty surfaces from dead ends into next-step launchpads.'
---

# Empty States Pattern

How to turn empty surfaces from dead ends into next-step launchpads.

## TL;DR (human)

Every list / collection / dashboard surface has an empty state. The empty state names what is missing, why, and what to do next. Different empty *causes* get different empty states. Empty is honest, not generic.

## For agents

### When to show an empty state

| Cause | Empty state |
|---|---|
| No records have ever been created (cold-start) | "No \<thing\> yet — create your first one" with CTA |
| Records exist but all filtered out | "No \<thing\> match your filter" with "Clear filter" |
| Records exist but user lacks permission to see them | "You don't have access to view \<thing\>" with permission-request hint |
| Records would be here but the data source is broken | "Could not load \<thing\> — try again" with retry CTA |
| Records exist but in a different scope (workspace, tenant) | "No \<thing\> in this workspace — switch workspace" |

The cause changes the right next step. Generic "No results" forces the user to guess.

### Primitive shape

```tsx
<EmptyState
  icon={<UsersIcon />}       // optional; reinforces semantic
  title={t("users.empty.cold.title")}            // "No teammates yet"
  description={t("users.empty.cold.description")} // "Invite people to start collaborating"
  action={                  // primary CTA
    <Button onClick={onInvite}>{t("users.empty.cold.invite")}</Button>
  }
  secondaryAction={         // optional secondary
    <Link href="/docs/users">{t("users.empty.cold.learn")}</Link>
  }
/>
```

The primitive is part of the shared catalog ([`primitives-pattern.md`](./primitives-pattern.md)). It enshrines layout, typography, spacing — never reinvent per screen.

### Three useful variants

1. **Cold-start empty** — onboarding moment; CTA is "create your first".
2. **Filtered empty** — user has data, filter excludes it; CTA is "clear filter".
3. **Error empty** — request failed; CTA is "retry".

The component prop hints which: `<EmptyState variant="cold" | "filtered" | "error">`. Variant changes the default icon + tone.

### Honesty about cause

Anti-pattern: a single "No results" that hides whether the user has zero data or just filtered it all out. The user clicks "create" thinking they need to create one — and discovers later they already had 50, hidden by a filter.

Honest pattern: detect the cause, choose the matching empty state.

```ts
function EmptyResolver({ rows, filter, error, hasPermission }) {
  if (!hasPermission) return <NoPermissionEmpty />;
  if (error) return <ErrorEmpty onRetry={...} />;
  if (filter && hasUnderlyingData) return <FilteredEmpty onClear={...} />;
  return <ColdStartEmpty onCreate={...} />;
}
```

Knowing whether underlying data exists may require a second query (a cheap `count(*)` that ignores the filter). That cost is well spent — the empty state's honesty depends on it.

### Loading vs empty

Loading and empty are different states:

- **Loading**: show a skeleton (per [`universal.md`](./universal.md) Rule 4).
- **Loaded + zero rows**: show empty state.

Anti-pattern: empty state flashes during loading (because `rows.length === 0` is briefly true before the fetch resolves). Avoid: distinguish "haven't fetched yet" from "fetched and got nothing". Only show empty when the fetch has resolved with zero rows.

### Empty state is also a teaching moment

Cold-start empty is often the first time a user encounters a feature. It is a *zero-cost onboarding surface*:

- Explain the feature in one sentence ("Teammates can collaborate on flows in this workspace").
- Tell them the next step ("Invite by email").
- Optional: link to docs / video for deeper context.

Filtered-empty and error-empty are not teaching moments — they are recovery moments. Keep them brief.

### Visuals

- **Icon / illustration**: optional. Reinforces semantic. Token-driven (no hardcoded color).
- **Tone**: matches the cause. Cold = warm invite. Filtered = neutral. Error = serious.
- **Size**: takes the same content area as the data would. Avoid pushing the empty state into a corner.

### The gate

A lint / completeness check flags patterns like:

```tsx
{rows.length === 0 ? <div>No results</div> : <Table rows={rows} />}
{rows.length === 0 && <p>No data</p>}
```

These bypass the empty-state primitive. Failure message points to the `\<EmptyState\>` import.

### Per-screen empty inventory

For each screen with collection surfaces, the completeness contract ([`universal.md`](./universal.md) Rule 9) requires an empty-state pass:

- Cold-start cause: ✓ covered with `\<EmptyState\>`.
- Filtered cause (if filters exist): ✓ covered separately.
- Error cause: ✓ covered with retry.

PR template includes this checklist for any UI-touching PR.

### Common failure modes

- **One empty state for all causes.** User cannot tell why empty. → Branch by cause.
- **Empty state in a 200×40 px slice.** Looks like a layout bug. → Match the data area.
- **Empty state without a CTA.** Dead end. → Always one primary next-step.
- **CTA that opens a complex flow.** Friction kills cold-start. → CTA is the simplest valid next action.
- **Empty state appears for one frame during loading.** Jittery. → Wait until the fetch resolves with zero.

### See also

- [`universal.md`](./universal.md) — Rule 4 (loading), Rule 5 (empty), Rule 9 (completeness).
- [`primitives-pattern.md`](./primitives-pattern.md) — `\<EmptyState\>` is a shared primitive.
- [`intl-pattern.md`](./intl-pattern.md) — empty-state copy is intl-keyed.
