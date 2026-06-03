---
title: 'Pillar — UI / UX'
description: 'How to keep a multi-screen product visually coherent, intl-ready, and accessible when agents are writing screens in parallel.'
---

# Pillar — UI / UX

How to keep a multi-screen product visually coherent, intl-ready, and accessible when agents are writing screens in parallel.

## Status

◐ Scoped, not yet detailed.

## Scope

| Concern | Universal principle | Concrete pattern |
|---|---|---|
| Design tokens | All color / spacing / typography come from named tokens; no hex / rgb / arbitrary class | CSS variables resolved through a whitelabel runtime; lint blocks raw color literals |
| Primitives | Shared `Button`, `Input`, `Select`, `Dialog`, `Table`, `Badge` — never bare HTML | One UI package; lint blocks native `\<button\>`, `\<input\>`, `\<select\>`, `\<dialog\>`, `\<form\>`, `\<table\>`, `\<a href\>` in shipped surfaces |
| Intl | Every user-visible string is keyed | `useT()` hook + locale JSON files; lint blocks JSX string literals + hardcoded `aria-label` / `title` / `placeholder` / `alt` |
| A11y | Keyboard-first; screen-reader pass before each release | A11y checklist + screen-reader checklist run in CI for changed screens |
| Motion | `prefers-reduced-motion` respected; durations from tokens | `motion-tokens.css`; `useReducedMotion()` hook |
| Loading | Skeletons over spinners for content-bearing surfaces | `\<Skeleton\>` primitive; spinners only for explicit in-flight actions |
| Empty states | Always-on; explain what to do next; honest about why empty | `\<EmptyState\>` primitive; lint blocks `\<div\>No results\</div\>` |
| Brand kit | One product name token; logos / colors swap at build per tenant | Whitelabel runtime resolves `productName`, `logoSrc`, `paletteRef` |
| Completeness | No `disabled: true` tabs; no `throw new Error('not implemented')` in shipped surfaces | Per-screen completeness contract gate |
| Status language | Use human verbs ("Saved", "Running", "Awaiting approval") not enum codes | Intl + lint for known jargon ("upserted", "succeeded") |

## Non-negotiables

1. **No raw HTML primitives in shipped surfaces.** Escape hatch: `// allow-native: \<reason\>`.
2. **No raw color values.** Tokens only.
3. **No hardcoded user-facing strings.** Intl keys only; brand tokens excepted via an explicit allow-list.
4. **No spinners replacing content.** Skeletons for loading; spinners only for inline actions.
5. **Every screen ships complete.** If a tab is not built, it does not appear in the nav.

## See also

- [`../architecture/file-size-budget.md`](/docs/pillars/architecture/file-size-budget) — `.tsx` budget forces sub-component extraction.
- [`../governance/README.md`](/docs/pillars/governance) — PR-intent flags UI rule violations.
- [`../../scripts/`](/docs/scripts) — color-literals, native-html, intl gates.

## Roadmap for this pillar

| Doc | Read when |
|---|---|
| [`universal.md`](/docs/pillars/ui-ux/universal) | First read; the 10 non-negotiables |
| [`design-tokens-pattern.md`](/docs/pillars/ui-ux/design-tokens-pattern) | Color / spacing / motion as named variables |
| [`primitives-pattern.md`](/docs/pillars/ui-ux/primitives-pattern) | Shared UI catalog; ban native HTML |
| [`intl-pattern.md`](/docs/pillars/ui-ux/intl-pattern) | Every visible string keyed |
| [`i18n-deep-pattern.md`](/docs/pillars/ui-ux/i18n-deep-pattern) | ICU MessageFormat; plurals/gender; Intl.* APIs; RTL; pseudo-locale |
| [`empty-states-pattern.md`](/docs/pillars/ui-ux/empty-states-pattern) | Cause-typed empty states with next-step CTA |
| [`a11y-checklist.md`](/docs/pillars/ui-ux/a11y-checklist) | Per-PR a11y checklist |
| [`accessibility-deep-pattern.md`](/docs/pillars/ui-ux/accessibility-deep-pattern) | WCAG-AA substance; 5 surfaces; ARIA discipline |
| [`whitelabel-pattern.md`](/docs/pillars/ui-ux/whitelabel-pattern) | Per-tenant brand kit + plan presets |
| [`design-system-governance-pattern.md`](/docs/pillars/ui-ux/design-system-governance-pattern) | Tier model; contribution path; deprecation; visual regression |
