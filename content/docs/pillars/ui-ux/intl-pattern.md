---
title: 'Intl Pattern'
description: 'How to never ship hardcoded user-visible strings, so the next locale is configuration, not a sweep.'
---

# Intl Pattern

How to never ship hardcoded user-visible strings, so the next locale is configuration, not a sweep.

## TL;DR (human)

Every visible string is a key in a locale file. Components resolve via `useT()` (or your hook). Keys are namespaced by screen / feature. Interpolation is structured (named placeholders, not positional). Aria, title, placeholder, alt attributes are also intl-resolved. Brand tokens (productName) bypass intl via an allowlist.

## For agents

### Key structure

Namespaced, dot-separated:

```
flows.editor.save.label
flows.editor.save.aria
flows.editor.save.success
flows.editor.save.error
users.empty.title
users.empty.description
users.empty.invite.cta
```

Conventions:

- First segment: feature / screen (`flows`, `users`, `dashboard`).
- Subsequent segments: nested context (`editor.save`, `empty`).
- Leaf: purpose (`label`, `aria`, `description`, `cta`, `success`, `error`).

This produces stable, greppable keys. Agents searching for "where is this string defined" find one place.

### Locale files

One file per locale, by convention:

```
locales/
├── en.json
├── es.json
├── pt-BR.json
└── ...
```

Contents:

```json
{
  "flows.editor.save.label": "Save",
  "flows.editor.save.aria": "Save the current flow",
  "flows.editor.save.success": "Flow saved.",
  "flows.editor.save.error": "Could not save: {reason}"
}
```

Flat key namespace; nested objects optional but get verbose for deep keys.

A small build step ensures every key exists in every shipped locale (or has a documented fallback to `en`).

### The hook

```ts
const t = useT();
// simple:
t("flows.editor.save.label")    // → "Save"
// with interpolation:
t("flows.editor.save.error", { reason: err.message })
                                  // → "Could not save: Network timeout"
```

Behavior:

- Missing key in current locale → falls back to `en`.
- Missing key in `en` → returns the key itself (visible bug; not silent).
- Interpolation values are escaped per the framework (HTML-escape in JSX context).

### What gets intl'd

User-visible:

- JSX text content.
- `aria-label`, `aria-description`.
- `title`, `placeholder`, `alt`.
- Error messages displayed to users (server returns `code` → client resolves to localized message).
- Toast / notification strings.
- Status labels (per [`universal.md`](/docs/pillars/ui-ux/universal) Rule 8).

Not intl'd:

- Brand tokens (product name, company name) — via `whitelabel` runtime, allowlisted.
- Code / technical identifiers (URLs, capability names, error codes).
- Author / contributor names.
- Untranslatable proper nouns (third-party brand names).

The allowlist of brand tokens lives in a small file (`i18n/exempt-tokens.json` or equivalent). Lint allows tokens in the allowlist; everything else hits the rule.

### The gate

Lint AST rules:

1. **JSX text literal** in `*.tsx` files where the content is non-empty and contains a letter. Fail.
2. **Hardcoded `aria-label` / `aria-description` / `title` / `placeholder` / `alt`** as string literals. Fail.

Exemptions:

- Empty strings.
- Strings matching the brand-token allowlist exactly.
- Strings inside `\<code\>`, `\<pre\>`, `\<kbd\>` JSX elements.
- Comments.

Lint script ships at [`../../scripts/check-intl.example.mjs`](/docs/scripts).

### Interpolation discipline

```ts
// ✓ named placeholders
t("flows.run.banner", { count: 3, name: "deploy" })
// → "3 flows running: deploy"

// ✗ positional
t("flows.run.banner", 3, "deploy")
```

Why named:

- Order can change per-locale.
- Reviewer sees the variable names; can verify they match the key.
- Adding a placeholder later does not break old call sites.

For pluralization, use the framework's plural rules:

```json
"flows.run.banner": "{count, plural, one {# flow} other {# flows}} running"
```

### Locale parity

A CI gate verifies:

- Every key in `en.json` exists in every other locale (or is documented as inheriting from `en`).
- No locale has keys that do not exist in `en` (orphans).
- Placeholder names match across locales for the same key.

This prevents one locale silently lagging.

### Pseudo-locale for testing

A `qa` or `pseudo` locale that transforms strings (e.g. `"Save"` → `"[!! Šåvé !!]"`) helps catch:

- Hardcoded strings (they don't transform; they stand out).
- Length-sensitive layouts (pseudo strings are ~30% longer).
- Encoding issues.

CI screenshots the app in pseudo locale; reviewer scans for hardcoded English.

### Migration path

1. Stand up the locale file structure + the hook.
2. Define keys for new code.
3. Generate baseline of existing hardcoded strings.
4. Gate to shrink-only.
5. Run a codemod / mass-extract for the easy cases (literal JSX text).
6. Manual sweep for complex cases (concatenations, conditionals).

### Common failure modes

- **String concatenation in JSX**: `\<div\>Hello {name}!\</div\>`. The literal portions are not intl'd. → Use interpolation: `t("greeting", { name })`.
- **Conditional fragments**: `{isLoading ? "Loading..." : "Ready"}`. Both literals leaked. → Two keys.
- **Concatenating intl results**: `t("a") + " " + t("b")`. Word order assumption baked in. → Single key with interpolation.
- **Localizing error codes** in server responses. Client cannot pattern-match. → Server returns stable codes; client maps to localized message.
- **Missing brand-token allowlist**. Every product-name use violates intl gate. → Add allowlist; whitelabel runtime resolves `productName`.

### See also

- [`universal.md`](/docs/pillars/ui-ux/universal) — Rule 3.
- [`whitelabel-pattern.md`](/docs/pillars/ui-ux/whitelabel-pattern) — brand-token resolution.
- [`a11y-checklist.md`](/docs/pillars/ui-ux/a11y-checklist) — aria labels are intl'd too.
