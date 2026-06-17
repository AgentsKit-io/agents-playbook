---
type: Playbook Pattern
title: 'Accessibility Checklist'
description: 'What every shipped surface passes before merge, and how to prove it.'
---

# Accessibility Checklist

What every shipped surface passes before merge, and how to prove it.

## TL;DR (human)

A two-tier check: automated (axe in CI on every changed screen) + manual (screen-reader pass on UI-touching PRs). Keyboard-first is non-negotiable. Use shared primitives — they enshrine a11y so individual screens cannot break it. Tests that assert on structure / aria, not on rendered text.

## For agents

### Per-PR checklist (UI-touching)

Tick all before requesting review:

**Keyboard**

- [ ] Every interactive element reachable by Tab.
- [ ] Tab order matches visual order; no surprise jumps.
- [ ] Focus is **visible** on every focusable element (token-based ring, not browser default).
- [ ] Enter / Space activates buttons; Enter activates links.
- [ ] Esc closes modals / popovers / dismissable surfaces.
- [ ] Arrow keys navigate within composite widgets (tabs, listbox, radiogroup).
- [ ] No keyboard trap (you can Tab into a region and Tab back out).

**Semantics**

- [ ] Page has a meaningful `\<title\>` per route.
- [ ] One `\<h1\>` per page; headings descend in order (no `h1 → h3` skip).
- [ ] Landmark elements present (`\<header\>`, `\<main\>`, `\<nav\>`, `\<aside\>`, `\<footer\>` — or aria landmark roles where appropriate).
- [ ] Form fields have associated `\<label\>` (or `aria-labelledby` / `aria-label`).
- [ ] Buttons have accessible names (text content or `aria-label`).
- [ ] Icons-only buttons have `aria-label`.

**Live regions**

- [ ] Toast / notification updates use `aria-live="polite"` (or `assertive` for blocking).
- [ ] Loading-completed announces (e.g. "12 results loaded").
- [ ] Error messages on form fields linked via `aria-describedby`.

**Color / contrast**

- [ ] Text passes WCAG AA contrast against background (4.5:1 for body, 3:1 for large).
- [ ] Information is not conveyed by color alone (icon + label, not just red text).
- [ ] Focus ring contrasts against both light and dark surfaces.

**Motion**

- [ ] `prefers-reduced-motion: reduce` short-circuits translates and rotations.
- [ ] Opacity / instant transitions remain (per [`universal.md`](/docs/pillars/ui-ux/universal) Rule 6).
- [ ] No autoplaying video / audio with sound.

**Images**

- [ ] Every `\<img\>` has `alt` (empty `alt=""` for decorative).
- [ ] Icons inside `\<button\>` are `aria-hidden="true"` when there is a visible label.
- [ ] SVG icons have `\<title\>` or `aria-label` when standalone.

**Forms**

- [ ] Required fields marked (`aria-required`, visual asterisk + legend).
- [ ] Validation errors announced (`aria-invalid`, message linked via `aria-describedby`).
- [ ] Submit button is disabled OR shows clear loading state during submission.
- [ ] Error summary at form top for long forms.

**Modals / Dialogs**

- [ ] Focus traps inside the dialog while open.
- [ ] Focus restores to the trigger when closed.
- [ ] `role="dialog"` + `aria-labelledby` referencing the title.
- [ ] Esc closes the dialog.
- [ ] Background scroll locked while open.

### Automated coverage

`@axe-core` (or your axe-equivalent) runs on every changed screen in CI. Findings of severity "serious" or "critical" fail the build. "minor" / "moderate" appear in PR comments for triage.

Sample integration with Playwright:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("/flows screen passes a11y scan", async ({ page }) => {
  await page.goto("/flows");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

### Manual screen-reader pass

Required for UI-touching PRs. Use one screen reader (per the team's primary platform):

- **VoiceOver** on macOS (Cmd+F5 to toggle).
- **NVDA** on Windows.
- **TalkBack** on Android.

Pass:

1. Navigate the page top-to-bottom with the screen reader.
2. Confirm: page title makes sense.
3. Confirm: each interactive element announces its purpose ("Save button", not "button button").
4. Confirm: forms announce labels and errors.
5. Confirm: navigation lands you on `\<main\>` quickly (skip-to-content link).

Document the pass in the PR description: "Screen reader: VoiceOver, 2026-MM-DD, all interactives announced cleanly."

### Tests assert on a11y, not on rendered text

```tsx
// ✗ wrong — breaks on intl / copy change
expect(screen.getByText("Save")).toBeInTheDocument();

// ✓ right — survives copy changes
expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
```

Using `byRole` + accessible name forces the test to verify the a11y attribute exists. A button without a name fails the test.

### Common failure modes

- **`tabIndex={-1}` on every focusable element** to "fix" tab order. Now no element is reachable. → Fix the source order, not the tabindex.
- **Custom `\<div\>` with `onClick`.** No keyboard handler; not reachable. → Use the `\<Button\>` primitive.
- **Aria attributes copied without understanding.** `aria-label="button"` is worse than no label. → Aria says what the element *is*, not its visual type.
- **Tooltip as the only label for an icon button.** Screen readers may not announce tooltips. → `aria-label` on the button itself.
- **`aria-hidden="true"` on an interactive element.** Hidden from screen readers but reachable by tab; very confusing. → `inert`, or actually remove from the tab order.
- **Color-only status indicators.** Color-blind users miss them. → Color + icon + text.

### Adoption path

1. Ship axe in CI on every page; allow existing violations (baseline).
2. Lock to shrink-only.
3. New PRs cannot add violations.
4. Sweep baseline screen-by-screen.

### See also

- [`universal.md`](/docs/pillars/ui-ux/universal) — Rule 6 (motion), Rule 7 (keyboard).
- [`primitives-pattern.md`](/docs/pillars/ui-ux/primitives-pattern) — primitives enshrine a11y.
- [`intl-pattern.md`](/docs/pillars/ui-ux/intl-pattern) — aria labels are intl-resolved.
