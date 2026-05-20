# Pillar — UI / UX

How to keep a multi-screen product visually coherent, intl-ready, and accessible when agents are writing screens in parallel.

## Status

◐ Scoped, not yet detailed.

## Scope

| Concern | Universal principle | Concrete pattern |
|---|---|---|
| Design tokens | All color / spacing / typography come from named tokens; no hex / rgb / arbitrary class | CSS variables resolved through a whitelabel runtime; lint blocks raw color literals |
| Primitives | Shared `Button`, `Input`, `Select`, `Dialog`, `Table`, `Badge` — never bare HTML | One UI package; lint blocks native `<button>`, `<input>`, `<select>`, `<dialog>`, `<form>`, `<table>`, `<a href>` in shipped surfaces |
| Intl | Every user-visible string is keyed | `useT()` hook + locale JSON files; lint blocks JSX string literals + hardcoded `aria-label` / `title` / `placeholder` / `alt` |
| A11y | Keyboard-first; screen-reader pass before each release | A11y checklist + screen-reader checklist run in CI for changed screens |
| Motion | `prefers-reduced-motion` respected; durations from tokens | `motion-tokens.css`; `useReducedMotion()` hook |
| Loading | Skeletons over spinners for content-bearing surfaces | `<Skeleton>` primitive; spinners only for explicit in-flight actions |
| Empty states | Always-on; explain what to do next; honest about why empty | `<EmptyState>` primitive; lint blocks `<div>No results</div>` |
| Brand kit | One product name token; logos / colors swap at build per tenant | Whitelabel runtime resolves `productName`, `logoSrc`, `paletteRef` |
| Completeness | No `disabled: true` tabs; no `throw new Error('not implemented')` in shipped surfaces | Per-screen completeness contract gate |
| Status language | Use human verbs ("Saved", "Running", "Awaiting approval") not enum codes | Intl + lint for known jargon ("upserted", "succeeded") |

## Non-negotiables

1. **No raw HTML primitives in shipped surfaces.** Escape hatch: `// allow-native: <reason>`.
2. **No raw color values.** Tokens only.
3. **No hardcoded user-facing strings.** Intl keys only; brand tokens excepted via an explicit allow-list.
4. **No spinners replacing content.** Skeletons for loading; spinners only for inline actions.
5. **Every screen ships complete.** If a tab is not built, it does not appear in the nav.

## See also

- [`../architecture/file-size-budget.md`](../architecture/file-size-budget.md) — `.tsx` budget forces sub-component extraction.
- [`../governance/README.md`](../governance/README.md) — PR-intent flags UI rule violations.
- [`../../scripts/`](../../scripts/) — color-literals, native-html, intl gates.

## Roadmap for this pillar

- `universal.md`
- `design-tokens-pattern.md`
- `primitives-pattern.md`
- `intl-pattern.md`
- `a11y-checklist.md`
- `whitelabel-pattern.md`
- `empty-states-pattern.md`
