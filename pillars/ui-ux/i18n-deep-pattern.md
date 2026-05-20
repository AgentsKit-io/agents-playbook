# Internationalisation Deep Pattern

Beyond "wrap every string in `t()`" — the substance of locale-correct UI: plural rules, gender, ICU formatting, RTL, dates, numbers, currency, sorting, search.

## TL;DR (human)

Real intl is harder than key extraction. Each language has plural rules; some have gender; numbers / dates / currencies format differently by locale; right-to-left languages flip layout. Use ICU MessageFormat for messages; `Intl.*` APIs for formatting; CLDR data for everything locale-specific. Test in pseudo-locales + at least one RTL.

## For agents

### Beyond key extraction

The [`intl-pattern.md`](./intl-pattern.md) sibling doc covers the basic discipline: every string keyed, `useT()` everywhere. This doc covers what comes after.

### ICU MessageFormat

Plain interpolation is insufficient for plurals and gender:

```ts
// ✗ wrong — doesn't pluralise; word order baked in
t("results", { count }) // "{count} result(s)"

// ✓ ICU MessageFormat
t("results", { count })
// "results": "{count, plural, =0 {No results} one {# result} other {# results}}"
```

ICU handles:

- **plural**: `=0`, `one`, `two`, `few`, `many`, `other` — depends on locale rules (CLDR).
- **select**: branching on a value (gender, status).
- **selectordinal**: ordinal numbers (1st, 2nd, 3rd).
- **number**, **date**, **time**: format with locale rules.

Library: `formatjs/intl-messageformat`, `messageformat`, `i18next` with the icu plugin.

Plural rules differ wildly:

- English: 2 forms (one / other).
- Russian: 4 forms (one / few / many / other).
- Arabic: 6 forms (zero / one / two / few / many / other).
- Japanese, Chinese: 1 form.

Hard-coding "one" / "other" breaks Russian. Use CLDR-derived rules.

### Gender

Some languages mark gender:

```
"welcome": "{gender, select, female {Bienvenida} male {Bienvenido} other {Bienvenidos}}, {name}"
```

Gendered translations need:

- The user's gender (or "prefer not to say" → use neutral form).
- A neutral fallback for languages that don't have gendered forms.

Avoid generating sentences from glued fragments — gender + plural agreement requires the whole sentence at once.

### Number formatting

```ts
// Locale-aware decimal separator, thousands grouping
new Intl.NumberFormat("en-US").format(1234567.89);   // "1,234,567.89"
new Intl.NumberFormat("de-DE").format(1234567.89);   // "1.234.567,89"
new Intl.NumberFormat("hi-IN").format(1234567.89);   // "12,34,567.89" (Indian numbering)
new Intl.NumberFormat("ar-EG").format(1234567.89);   // "١٬٢٣٤٬٥٦٧٫٨٩" (Arabic digits)

// Percentages
new Intl.NumberFormat("en-US", { style: "percent" }).format(0.42);  // "42%"

// Compact
new Intl.NumberFormat("en-US", { notation: "compact" }).format(12345);  // "12K"
```

### Currency

```ts
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(99.95);   // "$99.95"
new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(99.95);   // "￥100" (rounded; no decimals)
new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(99.95);   // "99,95 €"
```

The currency code (USD / JPY / EUR) is part of the data, not derived from locale. A user in Germany might view US dollars.

### Date and time

```ts
new Intl.DateTimeFormat("en-US").format(new Date());                            // "10/14/2024"
new Intl.DateTimeFormat("en-GB").format(new Date());                            // "14/10/2024"
new Intl.DateTimeFormat("ja-JP").format(new Date());                            // "2024/10/14"
new Intl.DateTimeFormat("ar-EG").format(new Date());                            // arabic-indic digits

// Relative time
new Intl.RelativeTimeFormat("en-US").format(-1, "day");                         // "1 day ago"
new Intl.RelativeTimeFormat("es-ES").format(-1, "day");                         // "hace 1 día"
```

Timezone discipline:

- Server stores UTC (ISO-8601 with offset).
- Client renders in user's locale + timezone.
- For "5 days from now" calculations: use the user's timezone (a date in Tokyo is not the same date in LA).

Libraries: native `Intl.*` is usually enough; `date-fns` + `date-fns-tz` or `Luxon` for richer manipulation.

### Right-to-left (RTL)

Arabic, Hebrew, Persian, Urdu read right-to-left.

CSS:

- `dir="rtl"` on `<html>` or per-region.
- Logical properties: `margin-inline-start` (not `margin-left`), `padding-inline-end` (not `padding-right`).
- Icons that imply direction (arrows, chevrons) mirror.
- Text alignment: `text-align: start` (not `text-align: left`).

Mixed-direction content (English text in Arabic UI): use `<bdi>` and `dir="auto"`.

Layouts that look fine in LTR can be broken in RTL:

- Asymmetric padding.
- Custom dropdowns with hardcoded positioning.
- Carousels with directional swipe.

Test in at least one RTL locale before shipping.

### Locale identifiers (BCP 47)

| Format | Meaning |
|---|---|
| `en` | English (any region) |
| `en-US` | English, United States |
| `en-GB` | English, United Kingdom |
| `pt-BR` | Portuguese, Brazil |
| `pt-PT` | Portuguese, Portugal |
| `zh-Hant` | Traditional Chinese |
| `zh-Hans` | Simplified Chinese |
| `ar-EG` | Arabic, Egypt |

User locale → fallback chain: `pt-BR` → `pt` → default (`en`).

Implement: locale = user setting + browser hint + URL param, with explicit precedence.

### Sort + search

Locale-aware string comparison:

```ts
"ä".localeCompare("z", "de");       // -1 (ä before z in German)
"ä".localeCompare("z", "sv");       // 1 (ä after z in Swedish)
```

`Intl.Collator` for batch sorting. Locale-aware sort matters for:

- User-facing lists (sort by name).
- Search match scoring.
- Autocomplete ranking.

### Pluralisation of intl keys themselves

Avoid:

```ts
t("invite-button") // "Invite"
t("invite-buttons") // "Invites"
```

Two keys, two translations, two slots to drift.

Instead:

```ts
t("invite", { count }) // ICU plural handles it
```

One key, one translation, plurals correct in every locale.

### Translation workflow

Three actors:

- **Developer**: adds keys to source locale (typically `en`).
- **Translator**: receives keys; produces target locales.
- **Translation management** (TMS): platform (Phrase, Crowdin, Lokalise) that syncs keys, manages translator work, returns completed translations.

CI checks:

- Every source-locale key exists in every shipped locale (or has documented fallback).
- No orphan keys (in target but not source).
- No untranslated keys (in source but not target, beyond fallback policy).

### Pseudo-locale for testing

A `qa` / `pseudo` locale transforms strings:

```
Save → [!! Šåvé !!]
Loading… → [!! Łõåðîñğ… (~30% longer) !!]
Welcome to Acme → [!! Wélçömé tö Áçmé !!]
```

Run the app in pseudo-locale:

- Hardcoded strings stand out (not transformed).
- Length-sensitive layouts show their breakage.
- Missing keys obvious (no `[!! ... !!]` wrap).

CI screenshots in pseudo-locale catches drift before release.

### Currency + region pairing

A pricing page shows different prices per region. Two concerns:

- **Display currency**: format per user locale, regardless of price source.
- **Tax / VAT**: per region; show inclusive vs exclusive per regulatory norm.

Avoid mixing the user's locale with the *product's* currency (a Japanese user viewing USD pricing — keep USD; don't auto-convert unless you mean to).

### Domain-specific localisation

Things that are NOT translated:

- Brand product name (per [`whitelabel-pattern.md`](./whitelabel-pattern.md) brand-token allowlist).
- Code identifiers, file paths, URLs.
- Author / contributor names.
- Third-party brand names (Slack, GitHub).

Things that ARE translated:

- Generic terms ("workspace", "user", "settings").
- Status labels ("Running", "Failed").
- Error messages.
- Help text.

### Common failure modes

- **Plain interpolation for plurals**. "1 result(s)" — broken in any non-English locale. → ICU MessageFormat.
- **Date / number raw**. `formatDate(d)` returns ISO. Users see machine format. → `Intl.*`.
- **Locale derived from currency**. User in Brazil viewing USD; UI assumes pt-BR formatting for `$`. → Locale and currency independent.
- **Hardcoded `margin-left`**. RTL breaks. → Logical properties.
- **String concat for sentences**. `t("hello") + " " + name + "!"` → word order assumption baked in. → ICU.
- **No RTL test**. Bidi bugs ship. → At least one RTL in CI snapshots.
- **Mixed-language fragments**. `Welcome to {productName}, ${userName}!` — direction ambiguity. → `<bdi>` / `dir="auto"`.
- **CLDR not bundled**. Locale features missing at runtime. → Include CLDR data for shipped locales (bundle size cost; trade-off).

### Tooling stack (typical)

| Concern | Tool |
|---|---|
| Runtime formatting | Native `Intl.*` (broad browser support) |
| Message formatting | formatjs, i18next, lingui, react-intl |
| Plural / gender data | CLDR (bundled by libraries above) |
| TMS platform | Phrase, Crowdin, Lokalise, Tolgee |
| Static extraction | i18next-parser, formatjs CLI, lingui extract |
| Coverage / parity | i18next-locize, in-house gate |
| Date manipulation | `date-fns` + `date-fns-tz`, Luxon, native `Intl.DateTimeFormat` |
| Pseudo-locale | pseudo-loc, in-house |

### Adoption path

1. **Day 0**: `useT()` for all strings; `en` only; parity gate disabled.
2. **Month 1**: add ICU MessageFormat for plurals.
3. **Month 2**: add `Intl.*` for date / number / currency.
4. **Quarter 1**: first non-`en` locale; parity gate; pseudo-locale in CI.
5. **Quarter 2**: TMS workflow with external translators.
6. **Quarter 3**: RTL locale; bidi audit on changed screens.
7. **Mature**: localised search, sort, region-aware features.

### See also

- [`intl-pattern.md`](./intl-pattern.md) — the basic discipline.
- [`whitelabel-pattern.md`](./whitelabel-pattern.md) — product name as a brand token.
- [`accessibility-deep-pattern.md`](./accessibility-deep-pattern.md) — `lang` attribute; reading order; bidi.
- [`universal.md`](./universal.md) — Rule 3 (intl every string), Rule 8 (human verbs).
