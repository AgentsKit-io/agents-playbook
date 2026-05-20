# Primitives Pattern

How to ship a one-package primitives catalog so every screen looks like the same product.

## TL;DR (human)

One UI package owns every interactive primitive. Components in screens import from that package. Native HTML elements (`\<button\>`, `\<input\>`, `\<select\>`, etc.) are lint-banned in shipped surfaces. Primitives are styled with design tokens; brand swap reaches them automatically.

## For agents

### The catalog

Minimum viable primitives catalog:

| Primitive | Replaces native | Variants |
|---|---|---|
| `Button` | `\<button\>`, `\<a href\>` (action) | primary / secondary / ghost / danger; sm / md / lg |
| `IconButton` | `\<button\>` with icon-only content | size + variant |
| `Link` | `\<a href\>` (navigation) | primary / muted |
| `Input` | `<input type="text|email|...">`| with-label / inline / search / password |
| `Textarea` | `\<textarea\>` | auto-resize / fixed |
| `Select` | `\<select\>` | single / multi (using Radix or equivalent) |
| `Checkbox` | `<input type="checkbox">` | with-label / indeterminate |
| `Radio`, `RadioGroup` | `<input type="radio">` | with-label |
| `Switch` | `<input type="checkbox">` (toggle role) | |
| `Dialog` | `\<dialog\>` | modal / drawer |
| `Tooltip` | `title` attr | |
| `Tabs` | `role="tablist"` boilerplate | |
| `Table` | `\<table\>` | sortable / paginated |
| `Badge` | `\<span\>` with class | status colors |
| `Avatar` | `\<img\>` | with-initials / with-presence |
| `EmptyState` | (none — new primitive) | with-icon / with-illustration |
| `Skeleton` | (loading shimmer) | text / block / row |
| `Toast` | (system notification) | success / error / info |

Add per project: `KPI`, `Card`, `Stat`, `Stepper`, `BreadcrumbBar`, etc.

### Why a primitive replaces a native element

| Concern | Native | Primitive |
|---|---|---|
| Styling | Browser default; varies | Token-driven; consistent |
| A11y attributes | Manually applied per use | Built-in; consistent |
| Keyboard handling | Browser default; subtle bugs | Tested + consistent |
| Focus ring | Browser default (sometimes invisible) | Token-driven; always visible |
| Disabled state | `disabled` only | `disabled` + visual + aria-disabled |
| Loading state | Manual hand-rolling | Built-in `loading` prop on `Button` |
| Form integration | Native | Compatible with form library |

A primitive enshrines the right pattern once; every consumer benefits.

### Built on something

Build on top of a headless library (Radix Primitives, React Aria, Headless UI) for a11y semantics. Wrap with your tokens + variants. Do not roll keyboard handling and focus management yourself; the headless libraries have spent thousands of hours on edge cases.

Your job:

- Provide the visual layer (tokens, variants).
- Provide consistent API (prop names, callback signatures) across primitives.
- Provide your project's idioms (loading prop, intl prop).

### API consistency

All primitives share API conventions:

```ts
interface BasePrimitiveProps {
  // identification
  id?: string;
  className?: string;     // composable; never wholesale-replaces internal styles
  // a11y
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  // state
  disabled?: boolean;
  loading?: boolean;      // where applicable
}
```

Variants are declared with a small variant utility (e.g. `cva` from `class-variance-authority`) so the same `variant` / `size` prop semantics apply everywhere.

### File / package shape

```
packages/ui/
├── src/
│   ├── button/
│   │   ├── button.tsx           // ≤ 200 lines
│   │   ├── button.stories.tsx   // visual catalog
│   │   ├── button.test.tsx
│   │   └── index.ts
│   ├── input/
│   ├── select/
│   ├── dialog/
│   ├── tokens.css               // token definitions (or imported from a sibling pkg)
│   └── index.ts                 // re-export all primitives
└── package.json
```

Per-primitive subdir lets you split the implementation as it grows; the index file is one barrel for consumers.

### Stories / visual catalog

Every primitive has a stories file. Two purposes:

1. **Visual regression**: snapshots run in CI; token drift surfaces.
2. **Documentation**: agents reading the primitive's API see all variants in one place.

Stories use Ladle / Storybook / your project's tool. Same toolchain as the rest of the repo.

### The gate

Lint rule:

```js
// no native html in shipped surfaces
"no-restricted-syntax": [
  "error",
  {
    selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea|dialog|form|table|a)$/]",
    message: "Use the shared primitive from @your/ui instead of native HTML.",
  },
],
```

Per file overrides for framework-mandated places (Next.js layouts, MDX content, raw HTML editors).

Escape hatch: `// allow-native: \<reason\>`. Counted by a gate that fails on growth.

### Migration path

Brownfield: large existing app, lots of native elements.

1. Ship primitives.
2. Generate baseline of native-html offenders.
3. Gate to shrink-only.
4. Codemod where possible (`<button onClick={...}>X\</button\>` → `<Button onClick={...}>X\</Button\>`).
5. Manual sweep for tricky cases (forms; `\<a\>` that mixes nav with action).

### Common failure modes

- **Primitive that wraps a native element 1:1 with no value-add.** Just use the native. → Primitive must add tokens + a11y + consistent API.
- **Primitive that does too much.** A `\<Button\>` with 30 props. → Split into composable primitives (`Button`, `Spinner`, `Icon` separately).
- **Primitive with a `style` prop accepted unchecked.** Defeats tokens. → `className` prop only; styles internal.
- **One-off variant added inline in a screen** (`<Button className="bg-red-500">`). → Add the variant to the primitive; do not override per-use.
- **No stories file.** Agents don't know the variants exist; reinvent. → Mandatory per primitive.

### See also

- [`universal.md`](./universal.md) — Rule 2.
- [`design-tokens-pattern.md`](./design-tokens-pattern.md) — what primitives style with.
- [`a11y-checklist.md`](./a11y-checklist.md) — primitive a11y contract.
