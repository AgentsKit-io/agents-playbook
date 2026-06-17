---
type: Playbook Pattern
title: 'Accessibility Deep Pattern'
description: 'Beyond the per-PR checklist — the substance of WCAG-AA conformance, the failure modes that matter, the testing discipline that catches what automation cannot.'
---

# Accessibility Deep Pattern

Beyond the per-PR checklist — the substance of WCAG-AA conformance, the failure modes that matter, the testing discipline that catches what automation cannot.

## TL;DR (human)

Automation catches ~30% of a11y bugs. The rest require manual + assistive-tech testing. Five surfaces matter: keyboard, screen-reader, contrast, motion, and cognitive load. Each has specific tests and specific failure modes. Conformance level: WCAG 2.2 AA as the default target; AAA is aspirational; A is too low.

## For agents

### What automation catches vs misses

**Catches** (axe, Lighthouse, similar tools):

- Missing `alt` attributes.
- Form fields without labels.
- Insufficient color contrast (mathematical check).
- Invalid ARIA usage (wrong attribute on wrong element).
- Missing `lang` on `\<html\>`.
- Duplicate IDs.
- Some keyboard-trap detection.

**Misses** (need manual):

- Whether the alt text is meaningful ("photo" is technically valid but useless).
- Whether the form label describes the right field.
- Whether the contrast is enough for *your* users' devices and environments.
- Whether ARIA semantics convey the right meaning.
- Whether tab order is logical.
- Whether the page makes sense when read top-to-bottom by a screen reader.
- Whether focus is visible (not just programmatically present).
- Whether content is understandable without color, motion, or sound.

Run automation. Trust manual.

### WCAG 2.2 — the four principles (POUR)

| Principle | Concern | What it means |
|---|---|---|
| **Perceivable** | Users can sense the content | Text alternatives, captions, contrast, resizable text |
| **Operable** | Users can interact | Keyboard, time enough to read, no seizures, easy navigation |
| **Understandable** | Users can comprehend | Readable, predictable, input assistance |
| **Robust** | Tech adapts to assistive tools | Valid markup, ARIA semantics, name+role+value |

Each principle has guidelines; each guideline has success criteria at A / AA / AAA levels. **Target AA**.

### The five surfaces

#### 1. Keyboard

Every interactive element must be:

- **Reachable** by Tab (Shift+Tab for reverse).
- **Operable** by Enter (links) or Enter+Space (buttons) per HTML semantics.
- **Focus-visible**: distinct token-based outline; not the browser default (sometimes invisible against dark themes).
- **No trap**: focus can leave the region.

Composite widgets have specific keyboard semantics:

| Widget | Keys |
|---|---|
| **Tabs (tablist)** | Arrow keys cycle tabs; Home/End jump to first/last; Tab leaves the tablist |
| **Listbox** | Arrow keys move selection; Home/End; Space toggles (multi); Enter confirms |
| **Menu** | Arrow keys; Esc closes; Tab leaves; first-letter typeahead |
| **Tree** | Arrow keys; Right expands; Left collapses |
| **Dialog** | Tab cycles within; Esc closes; focus restores on close |
| **Combobox** | Down opens; arrows navigate options; Esc closes; Tab confirms-and-leaves |

Use a headless library (Radix Primitives, React Aria) — it ships the right semantics. Hand-rolling is how subtle bugs creep in.

#### 2. Screen reader

Three screen readers cover the world:

- **VoiceOver** (macOS / iOS).
- **NVDA** (Windows, free).
- **TalkBack** (Android).

Test on at least one per platform you support.

Each interactive element must announce:

- **Name** (what is this?) — usually the visible label or `aria-label`.
- **Role** (button / link / combobox / etc.) — usually inferred from element type or `role` attribute.
- **State** (pressed / checked / expanded / disabled / busy) — `aria-pressed`, `aria-expanded`, etc.
- **Value** (current value, where applicable) — `aria-valuenow` etc.

Page-level:

- `\<title\>` is meaningful (the user knows where they are).
- Headings are hierarchical (h1 → h2 → h3, no skip).
- Landmark roles (`\<header\>`, `\<main\>`, `\<nav\>`, `\<aside\>`, `\<footer\>`) let users jump.
- Live regions (`aria-live="polite"` or `aria-live="assertive"`) announce dynamic updates without forcing focus.

#### 3. Contrast

WCAG AA thresholds:

- **Normal text** (< 18pt): contrast ≥ 4.5:1.
- **Large text** (≥ 18pt or ≥ 14pt bold): contrast ≥ 3:1.
- **UI components / graphics**: contrast ≥ 3:1.

Tooling: axe DevTools, the Stark plugin, Lighthouse. Build-time CI check too.

Token discipline (per [`design-tokens-pattern.md`](/docs/pillars/ui-ux/design-tokens-pattern)): semantic tokens (`text-primary`, `surface-1`) carry an implicit contrast contract. Changing the palette must respect the contract or fail CI.

Color alone is not enough:

- Error states: red border + error icon + error text.
- Required fields: asterisk + "(required)" + `aria-required`.
- Active tab: color + underline + `aria-selected`.

#### 4. Motion

Respect `prefers-reduced-motion: reduce`:

- **Translates and rotations**: short-circuit to instant.
- **Opacity changes, color fades**: keep (typically not vestibular triggers).
- **Parallax**: disable entirely.
- **Auto-playing video**: pause.
- **Carousels**: stop auto-rotation; user-controlled only.

No flash: nothing flashes > 3 times / second (seizure risk).

Animations are communicative, not decorative — see [`universal.md`](/docs/pillars/ui-ux/universal) Rule 6.

#### 5. Cognitive load + clarity

Less measurable but equally important:

- **Plain language**: 9th-grade reading level for general audiences.
- **Consistent labelling**: the same action has the same name across screens.
- **Predictable navigation**: nav structure persistent across pages.
- **Input assistance**: clear errors, format hints, examples.
- **Time limits**: warn before timeout; allow extension.
- **No surprise context shifts**: focus / page changes happen on user action, not on input typing.

### Specific patterns and their failures

#### Icon-only buttons

```tsx
// ✗ wrong
<button onClick={onClose}><X /></button>

// ✓ right
<button aria-label={t("dialog.close")} onClick={onClose}>
  <X aria-hidden="true" />
</button>
```

The icon is decorative; the button has a name.

#### Form errors

```tsx
// ✓ right
<label htmlFor="email">{t("form.email.label")}</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
  <span id="email-error" role="alert">{t("form.email.error.required")}</span>
)}
```

Required: explicit; aria-invalid: state; aria-describedby: link to the message; role="alert": announces on appearance.

#### Modal dialogs

```tsx
<dialog
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">{t("confirm.title")}</h2>
  <p id="dialog-description">{t("confirm.description")}</p>
  {/* focus trap; Esc closes; focus restores */}
</dialog>
```

Native `\<dialog\>` is increasingly viable; headless libraries (Radix Dialog) wrap with full a11y.

#### Loading states

```tsx
// ✓ right
<div
  role="status"
  aria-busy={isLoading}
  aria-live="polite"
>
  {isLoading ? <Skeleton /> : <Content />}
</div>
```

Loading is announced; once loaded, polite update doesn't interrupt.

#### Skip-to-content link

```tsx
<a
  href="#main"
  className="sr-only focus:not-sr-only"
>
  {t("a11y.skip-to-main")}
</a>
<main id="main">...</main>
```

Hidden until focused (first Tab); jumps screen-reader past navigation.

### Testing discipline

Per UI-touching PR:

1. **Axe scan** (CI-automatic): no critical / serious violations.
2. **Keyboard pass**: Tab through the changed screen; verify reachability + focus + activation.
3. **Screen-reader pass**: spot-check the changed screen with one screen reader.

Quarterly:

- **Full screen-reader pass**: all primary user journeys.
- **Mobile screen-reader pass**: TalkBack (Android) or VoiceOver iOS.
- **User testing with disability community**: yields findings automation cannot.

### Common ARIA misuse

| Mistake | Why wrong | Fix |
|---|---|---|
| `role="button"` on a `\<div\>` with no keyboard handler | Reachable; not operable | Use `\<Button\>` primitive |
| `aria-label` duplicating visible text | Redundant; sometimes contradictory | Either visible label OR aria-label, not both |
| `aria-hidden="true"` on a focusable element | Hidden semantically; reachable by Tab | Use `inert` instead, or remove from tab order |
| `role` invalidating native semantics | `<button role="link">` makes screen readers confused | Use the right element |
| Bare `\<div\>` for everything | No semantics; screen reader announces nothing | Use semantic HTML; fall back to ARIA |

**"No ARIA is better than bad ARIA"** is the rule of thumb.

### Internationalisation interaction

A11y intersects with intl heavily:

- **Direction** (`dir="rtl"` for Arabic, Hebrew): layout flips; icons / arrows mirror.
- **Lang attribute**: `<html lang="es">`, or per-element `lang` for mixed-language content.
- **Pluralisation**: screen readers benefit from natural plurals, not "1 result(s)".
- **Number formatting**: `Intl.NumberFormat` for locale-aware reading.

### Mobile-specific

- **Touch targets**: ≥ 44×44 px (WCAG 2.5.5 AAA; AA aspirational).
- **Mobile screen readers** (VoiceOver iOS, TalkBack): swipe-navigation patterns differ from desktop.
- **Zoom**: text up to 200% should be readable without horizontal scroll.
- **Orientation**: pages work in portrait + landscape unless essential to be one orientation.

### Document structure

| Element | Purpose | Common mistake |
|---|---|---|
| `<html lang="...">` | Pronunciation, screen-reader voice | Missing or wrong code |
| `\<title\>` | Page identification | Same title for every route |
| `\<h1\>` | Top-level heading | Multiple h1s, or none |
| `\<main\>` | Primary content landmark | Missing |
| `\<nav\>` | Navigation landmark | Missing or duplicated without labels |
| `\<aside\>` | Tangential content | Used for primary content |
| `\<footer\>` | Page footer landmark | Used as a div |

### Adoption path

1. **Day 0**: axe in CI; baseline existing violations.
2. **Week 1**: keyboard checklist on every new PR.
3. **Month 1**: shared primitives all carry correct a11y; manual reviews catch screen-reader gaps.
4. **Quarter 1**: first full screen-reader sweep; surface findings; fix in priority order.
5. **Quarter 2+**: user testing with disability community; chaos a11y (test screens under reduced-motion + magnification + slow connection).

### Common failure modes

- **Automation as proof**. axe clean = a11y done. Tons of bugs slip through. → Manual is mandatory.
- **A11y as a final polish**. Bolted on at release time; rebuilds half the UI. → Build-in from primitives day 1.
- **Focus invisible**. Outline removed for "design"; nobody can navigate. → Token-based ring on every focusable element.
- **Live region overuse**. Every change announces; users overwhelmed. → Polite by default; assertive only for blocking.
- **Custom widgets without keyboard semantics**. Looks like a select; isn't. → Use the headless library; or use the real `\<select\>`.
- **Translations break the layout**. German is 30% longer; English-only design overflows. → Test with pseudo-locale; test with long-string fixtures.

### See also

- [`universal.md`](/docs/pillars/ui-ux/universal) — Rule 6 (motion), Rule 7 (keyboard + SR).
- [`a11y-checklist.md`](/docs/pillars/ui-ux/a11y-checklist) — per-PR checklist; this doc is the substance behind it.
- [`primitives-pattern.md`](/docs/pillars/ui-ux/primitives-pattern) — primitives enshrine a11y.
- [`design-tokens-pattern.md`](/docs/pillars/ui-ux/design-tokens-pattern) — contrast as a token contract.
- [`intl-pattern.md`](/docs/pillars/ui-ux/intl-pattern) — language + direction.
