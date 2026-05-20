# UI / UX — Universal Principles

How to keep a multi-screen product visually coherent, intl-ready, accessible, and honest when agents author screens in parallel.

## TL;DR (human)

Ten rules. They make UI quality scalable: a new screen by a new agent looks like the rest of the product on day one, without manual cohesion sweeps. Each rule corresponds to a structural gate; the gates are how the rules hold under multi-agent edits.

1. Design tokens for every visual value.
2. Shared primitives — no bare HTML inputs in shipped surfaces.
3. Intl every user-visible string.
4. Skeletons for content loading; spinners only for inline actions.
5. Empty states always-on, always tell next step.
6. Motion respects `prefers-reduced-motion`; durations from tokens.
7. Keyboard-first; screen-reader pass per changed screen.
8. Status language in human verbs, never enum codes.
9. Per-screen completeness contract — no disabled tabs, no `not implemented`.
10. Whitelabel-ready — product name + logo + palette swappable.

## For agents

### Rule 1 — Design tokens for every visual value

All color, spacing, radius, typography, motion duration: from named tokens. Never hex / rgb / hsl literals, never arbitrary class values (`bg-[#ff0000]`), never inline `style={{ color: "#..." }}`.

```tsx
// ✗ wrong
<div className="bg-[#1a1a1a] p-[12px]" style={{ color: "rgb(255,0,0)" }} />

// ✓ right
<div className="bg-surface-1 p-3 text-danger" />
```

Tokens resolve through a runtime layer that supports whitelabel swap (Rule 10). The token names are stable; the values rotate per brand kit.

Gate: lint scan for hex / rgb / hsl / oklch literals + arbitrary class values + inline color styles. See [`../../scripts/README.md`](../../scripts/README.md).

**Failure mode prevented:** brand drift; screens that look like different products; whitelabel reskin requires touching every screen.

### Rule 2 — Shared primitives — no bare HTML inputs in shipped surfaces

`<button>`, `<input>`, `<select>`, `<dialog>`, `<form>`, `<table>`, `<a href>` are **banned** in shipped surfaces. Use the shared `Button`, `Input`, `Select`, `Dialog`, `Form`, `Table`, `Link` primitives.

Why: native primitives differ across browsers and lack the project's a11y / styling / event semantics. The shared primitive is the contract.

Escape hatch: `// allow-native: <reason>` on the line. Counted by a gate that fails if the count grows.

Gate: lint regex for the banned tags in `**/screens/**`, `**/components/**` (configure paths per project). One escape hatch comment per offence.

**Failure mode prevented:** new screen ships with native `<button>`; styling drifts; a11y attributes inconsistent; keyboard handling differs.

### Rule 3 — Intl every user-visible string

Every visible string is keyed in a locale file and resolved via `useT()` (or your equivalent hook). No JSX string literals. No hardcoded `aria-label`, `title`, `placeholder`, `alt`.

```tsx
// ✗ wrong
<button aria-label="Save">Save</button>

// ✓ right
<button aria-label={t("flows.editor.save.aria")}>{t("flows.editor.save.label")}</button>
```

Brand tokens (product name, company name) are exempt — they live in a small allowlist and resolve from whitelabel runtime.

Gate: lint AST scan for JSX text nodes with non-empty string literals + hardcoded `aria-*` / `title` / `placeholder` / `alt` attributes. Exempt: comments, `<code>` / `<pre>` content, allowlisted brand tokens.

**Failure mode prevented:** half-translated UI; aria attributes only in English; brand rename requires touching every screen.

### Rule 4 — Skeletons for content loading; spinners only for inline actions

When a content surface is loading data:

- Show a **skeleton** that matches the final layout shape.
- Do not show a spinner that replaces content.

Spinners are reserved for inline actions (a button while submitting; a row while saving).

Why: skeletons preserve layout (no jank when content arrives); communicate roughly what is coming (sets expectation); avoid the "what is this loading forever?" panic state.

Gate: lint regex for `<Spinner>` (or equivalent) inside content-bearing layout containers. Combined with manual review for "this surface shows a spinner instead of a skeleton".

**Failure mode prevented:** layout jank on every page load; users panic at indeterminate spinners.

### Rule 5 — Empty states always-on, always tell next step

Every list / collection surface has an empty state component. The empty state:

- States what would be here (one sentence).
- States the next step (a CTA, a link, an instruction).
- Is **honest** about why empty (no data yet vs filtered out vs permission-denied — each is a different empty state).

```tsx
// ✗ wrong
{rows.length === 0 ? <div>No results</div> : <Table rows={rows} />}

// ✓ right
{rows.length === 0
  ? <EmptyState
      title={t("users.empty.title")}
      description={t("users.empty.description")}
      action={<Button onClick={onInvite}>{t("users.empty.invite")}</Button>}
    />
  : <Table rows={rows} />}
```

Different empty causes → different empty states. "No results match filter" is different from "No users in this workspace yet".

Gate: a completeness check that flags `length === 0 ? <div>` patterns; the `<EmptyState>` primitive must be used.

**Failure mode prevented:** users land on an empty page with no idea what to do; honest empty cause is hidden behind generic "no results".

### Rule 6 — Motion respects `prefers-reduced-motion`; durations from tokens

Every animation / transition:

- Reads `prefers-reduced-motion` from the user OS; honors it.
- Uses duration tokens (`--duration-fast`, `--duration-normal`, `--duration-slow`).
- Does not exceed ~300ms for UX feedback; longer durations are deliberate and rare.

Two principles:

- **Motion is communication, not decoration.** Movement clarifies state change. Decorative motion fatigues.
- **Reduced motion is not "no motion".** Opacity changes, color changes, and instant transitions remain. Translates and rotations stop.

Gate: lint scan for `transition-duration: \d` (hardcoded ms), `transform: translate` in CSS without a `@media (prefers-reduced-motion: reduce)` partner rule (heuristic; opt-in).

**Failure mode prevented:** vestibular-disorder users experience nausea; brand motion drift across screens.

### Rule 7 — Keyboard-first; screen-reader pass per changed screen

Every interactive element:

- Is reachable by Tab (logical order).
- Has a visible focus indicator (not the default browser outline, but a token-based replacement).
- Triggers its primary action on Enter / Space (per HTML semantics — Enter for buttons / links; Enter+Space for buttons; Enter only for links).
- Has an accessible name (label, aria-label, aria-labelledby).

For changed screens, run a screen-reader pass before merging:

- VoiceOver (macOS) / NVDA (Windows) / TalkBack (Android).
- Read top-to-bottom, then by region.
- Confirm: page title makes sense; landmarks navigate cleanly; live regions announce.

Gate: axe / `@axe-core` automated scan on every changed screen in CI. Screen-reader pass is a manual checklist linked from the PR template for ui-touching PRs.

**Failure mode prevented:** screens that are unusable without a mouse; screen readers reading raw class names or "button button button" with no context.

### Rule 8 — Status language in human verbs, never enum codes

User-visible status:

- ✓ "Saved", "Running", "Awaiting approval", "Failed to send", "Reconnecting…"
- ✗ "succeeded", "PENDING", "AWAITING_HUMAN_INPUT", "error_state_2"

Internal status enums map to user-visible labels via an i18n table. Multiple internal states can collapse to one user-visible label when the user does not need the distinction.

Gate: lint scan for known internal enum values in JSX text nodes ("succeeded", "pending", "upserted", etc.). Project maintains the project-specific banned list.

**Failure mode prevented:** users see "AWAITING_HUMAN_INPUT" and ask support what it means; brand voice broken by leaked enum strings.

### Rule 9 — Per-screen completeness contract — no disabled tabs, no `not implemented`

Every screen that ships passes the completeness contract:

- No `TODO` / `FIXME` markers in the shipped tree.
- No `disabled: true` tabs in nav.
- No `throw new Error('not implemented')` in shipped surfaces.
- No empty exported component bodies.
- Every tab in the screen renders meaningful content.

If a feature is not built, it does not ship in nav. Behind a feature flag, fine. Built but disabled, never.

Gate: a `check-completeness` script scans the shipped tree. See [`../../scripts/README.md`](../../scripts/README.md).

Per-screen completeness contracts live in `docs/completion/<screen>.md` (or equivalent): what "done" means for that screen, what tabs / sub-views are in scope.

**Failure mode prevented:** screens that look done but break on click; demo gets to a tab that crashes; investor sees `[NOT IMPL]` in production.

### Rule 10 — Whitelabel-ready — product name + logo + palette swappable

Even if you do not currently sell whitelabel: build as if you might. Costs little; saves enormously when the request comes.

What that means:

- **Product name** comes from a `productName` token, not hardcoded in JSX. Default to a fallback (e.g. `"App"`) so omitting the token does not produce empty strings.
- **Logo / favicon** swappable via a brand-kit JSON.
- **Palette / typography** swappable via token overrides.
- **Plan presets** (which features are enabled for which tier) configurable.
- **Build / runtime distinction**: brand assets baked at build for performance; runtime overrides for preview / OEM admin.

Gate: a small "whitelabel readiness" check ensures `productName` token usage in user-visible strings; no hardcoded brand strings in shipped code outside the allowlist.

**Failure mode prevented:** "we got an OEM customer; can you reskin?" answered with a six-month project; brand strings leak via PRs that bypass the intl gate.

## See also

- [`design-tokens-pattern.md`](./design-tokens-pattern.md), [`primitives-pattern.md`](./primitives-pattern.md), [`intl-pattern.md`](./intl-pattern.md), [`empty-states-pattern.md`](./empty-states-pattern.md), [`a11y-checklist.md`](./a11y-checklist.md), [`whitelabel-pattern.md`](./whitelabel-pattern.md)
- [`../architecture/file-size-budget.md`](../architecture/file-size-budget.md) — `.tsx` budget forces sub-component extraction.
- [`../quality/quality-gates-pattern.md`](../quality/quality-gates-pattern.md) — token / native-html / intl / completeness gates.
