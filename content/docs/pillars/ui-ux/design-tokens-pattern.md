---
title: 'Design Tokens Pattern'
description: 'How to define visual values once and let them flow through every screen, theme, and brand.'
---

# Design Tokens Pattern

How to define visual values once and let them flow through every screen, theme, and brand.

## TL;DR (human)

Tokens are named visual variables: `surface-1`, `text-primary`, `radius-md`, `duration-fast`. Components reference tokens; never literal values. Tokens resolve through a runtime layer that supports whitelabel swap. A lint gate blocks raw hex / rgb / hsl / arbitrary class values.

## For agents

### Token taxonomy

Three layers, by abstraction:

1. **Primitive tokens** — the raw values. `--color-blue-500: oklch(...)`. Generated from a palette; rarely referenced directly.
2. **Semantic tokens** — what the value means. `--color-text-primary`, `--color-surface-1`, `--color-danger`. Component code references these.
3. **Component tokens** — per-component overrides. `--button-primary-bg`, `--input-border-radius`. Optional; use when a component diverges from semantic tokens.

Rules:

- Components reference **semantic** tokens.
- Themes / brand kits override **primitive** tokens (and sometimes semantic).
- Component tokens exist only when a component diverges from the standard semantic mapping.

### Categories

| Category | Examples |
|---|---|
| Color (surface) | `surface-0`, `surface-1`, `surface-2`, `surface-elevated` |
| Color (text) | `text-primary`, `text-secondary`, `text-disabled`, `text-on-accent` |
| Color (accent / status) | `accent`, `success`, `warning`, `danger`, `info` |
| Spacing | `space-1` ... `space-12` (typically a multiplicative scale) |
| Radius | `radius-sm`, `radius-md`, `radius-lg`, `radius-full` |
| Typography (size) | `text-xs`, `text-sm`, `text-base`, `text-lg`, ... |
| Typography (weight) | `font-regular`, `font-medium`, `font-bold` |
| Typography (family) | `font-sans`, `font-mono`, `font-display` |
| Shadow | `shadow-1`, `shadow-2`, `shadow-3` |
| Motion (duration) | `duration-fast`, `duration-normal`, `duration-slow` |
| Motion (easing) | `ease-in`, `ease-out`, `ease-in-out`, `ease-emphasized` |
| Z-index | `z-base`, `z-dropdown`, `z-modal`, `z-toast` |

### Storage shape

CSS variables on `:root`:

```css
:root {
  /* Primitives (palette) */
  --color-blue-500: oklch(0.62 0.18 250);
  --color-gray-100: oklch(0.97 0 0);
  /* ... */

  /* Semantic */
  --surface-1: var(--color-gray-100);
  --text-primary: var(--color-gray-900);
  --accent: var(--color-blue-500);
  /* ... */

  /* Motion */
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 320ms;
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-1: var(--color-gray-900);
    --text-primary: var(--color-gray-100);
    /* ... */
  }
}
```

Tailwind config / your CSS framework maps utility classes to these variables:

```js
// tailwind.config.ts
colors: {
  surface: {
    0: "var(--surface-0)",
    1: "var(--surface-1)",
  },
  text: { primary: "var(--text-primary)" },
  accent: "var(--accent)",
}
```

So `<div className="bg-surface-1 text-text-primary" />` works.

### Runtime whitelabel swap

The same token names; different values per brand:

```ts
applyBrandKit({
  palette: {
    accent: "oklch(0.65 0.20 30)",  // orange brand
    surface1: "oklch(0.99 0 0)",
  },
  typography: {
    fontSans: "Inter, system-ui",
  },
  motion: { ... },
});
```

`applyBrandKit` writes the values to `:root` style or generates a new CSS file at build time. See [`whitelabel-pattern.md`](./whitelabel-pattern.md).

### Naming discipline

- **Semantic over literal**: `surface-1`, not `gray-100`. The component does not care it's gray.
- **Numbered ramps** for stacking surfaces / text: `surface-0 < surface-1 < surface-elevated`.
- **Avoid `dark-` / `light-` prefixes** in semantic tokens; theme toggling swaps values, not names.
- **No JSX-side derivations** like `text-primary-with-opacity-50`. Add a token if you need it.

### The gate

Lint rules:

1. **No hex / rgb / hsl / oklch literals** in `*.{ts,tsx,css,scss}`. Pattern: `#[0-9a-fA-F]{3,8}`, `rgb\(`, `hsl\(`, `oklch\(`.
2. **No Tailwind arbitrary class values** for color / spacing: `bg-\[`, `text-\[`, `p-\[`, etc.
3. **No inline color/spacing styles** in JSX: `style={{ color: ..., padding: ... }}`.

Escape hatch: `// allow-color-literal: \<reason\>`. Counted; growth fails the gate.

The gate runs at pre-commit on changed files; full sweep in CI.

### Migration path

Brownfield adoption:

1. Define the token catalog (semantic layer first; primitives second).
2. Generate baseline of existing offenders.
3. Gate to shrink-only.
4. Codemod the easy cases (`#fff` → `var(--surface-0)`).
5. Manual sweep for ambiguous cases (which surface / text token does this map to?).

### Common failure modes

- **Token used as literal**: `<div className="bg-[var(--surface-1)]" />` — defeats the system. → Tailwind config exposes the token as a class.
- **Semantic skipped**: components reference primitive tokens directly (`bg-blue-500`). Brand swap impossible without code change. → Lint flags primitive references in components.
- **Token count explosion**: 80 color tokens for "different shades of accent". → Reduce; the palette is the contract.
- **Theme toggle works but component disagrees**: hardcoded value somewhere. → Run the gate; find the hardcode.
- **Whitelabel test never run**: tokens work in default brand only. → A test brand-kit ships with the repo; CI renders against it.

### See also

- [`universal.md`](./universal.md) — Rule 1.
- [`primitives-pattern.md`](./primitives-pattern.md) — primitives consume tokens.
- [`whitelabel-pattern.md`](./whitelabel-pattern.md) — runtime swap.
