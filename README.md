# Px to Tailwind Plus

Type `p-16px`, get `p-4`. Paste `p-[20px]` from a design handoff, get `p-5`.
Works with **Tailwind v4** dynamic spacing and **Tailwind v3** classic scale, in
**VS Code** and **Cursor**.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/maksym-vasianin.px-to-tailwind-plus?label=VS%20Marketplace&color=0EA5E9)](https://marketplace.visualstudio.com/items?itemName=maksym-vasianin.px-to-tailwind-plus)
[![Open VSX](https://img.shields.io/open-vsx/v/maksym-vasianin/px-to-tailwind-plus?label=Open%20VSX&color=0891B2)](https://open-vsx.org/extension/maksym-vasianin/px-to-tailwind-plus)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## What it does

| You write         | You get        | Why                        |
| ----------------- | -------------- | -------------------------- |
| `p-16px`          | `p-4`          | pixel shorthand            |
| `p-[20px]`        | `p-5`          | arbitrary value reduced    |
| `p-[1.25rem]`     | `p-5`          | rem resolved against 16px  |
| `text-14px`       | `text-sm`      | named font-size scale      |
| `rounded-8px`     | `rounded-lg`   | named radius scale         |
| `-mt-8px`         | `-mt-2`        | negatives                  |
| `md:hover:p-16px` | `md:hover:p-4` | variant chains             |
| `@apply p-16px;`  | `@apply p-4;`  | CSS `@apply` rules         |

It converts **as you type**, on **save**, via a **quick fix**, or across a whole
file with a command. Off-scale values fall back to an arbitrary value
(`w-50.5px` → `w-[50.5px]`) so nothing is ever silently rounded.

## Where it applies

Only inside real class context — never in comments, plain strings or unrelated
code:

- `class`, `className`, `:class`, `v-bind:class`, Svelte `class:`
- class utilities: `clsx`, `cn`, `cx`, `cva`, `classnames`, `tw`, `twMerge`,
  `twJoin` (configurable), including `className={clsx("…")}`
- Tailwind `@apply` rules in CSS/SCSS/Less/PostCSS

```jsx
<div className="p-16px" />        // → p-4
const label = "p-16px";           // untouched — not class context
// p-16px in a comment            // untouched
<div id="p-16px" />               // untouched
```

## Install

**VS Code** — search **“Px to Tailwind Plus”**, or:

```
ext install maksym-vasianin.px-to-tailwind-plus
```

**Cursor** — installs from Open VSX. Search **“Px to Tailwind Plus”**, or grab
the `.vsix` from the
[Open VSX page](https://open-vsx.org/extension/maksym-vasianin/px-to-tailwind-plus)
and run **Extensions: Install from VSIX…**.

> Cursor mirrors Open VSX on its own schedule and can sit a release behind. If
> you need the newest version immediately, install the `.vsix` directly.

## Modes

Set `pxToTwPlus.mode`:

**`v4`** (default) — dynamic spacing, `value = px / spacingBasePx`. If the value
lands on the allowed step it becomes a bare class, otherwise an arbitrary value.
Quarter-step classes render as `calc(var(--spacing) * N)` and are valid v4.

| You type   | You get      |
| ---------- | ------------ |
| `p-16px`   | `p-4`        |
| `px-13px`  | `px-3.25`    |
| `p-18px`   | `p-4.5`      |
| `w-1px`    | `w-px`       |
| `w-50.5px` | `w-[50.5px]` |

**`v3`** — the classic fixed scale; off-scale values become arbitrary.

| You type      | You get        |
| ------------- | -------------- |
| `p-16px`      | `p-4`          |
| `p-13px`      | `p-[13px]`     |
| `rounded-4px` | `rounded`      |
| `border-3px`  | `border-[3px]` |

## Units

**px** and **rem** are both understood; rem resolves against the 16px root. A
rem value is only rewritten when it lands on a scale token, so it is never
churned into pixels:

| You type          | You get   |
| ----------------- | --------- |
| `p-1rem`          | `p-4`     |
| `p-[1.25rem]`     | `p-5`     |
| `text-[1.125rem]` | `text-lg` |
| `p-[1.3rem]`      | unchanged |

**`em` is never converted.** It resolves against the *parent* font size, which
cannot be known from the text, so any value would be a guess. `%`, `vw` and
`calc()` are left alone for the same reason.

## Coverage

Padding, margin, `gap`, `w/h/size`, `min-*`, `max-*`, inset, `translate-*`,
`space-*`, `scroll-m*`, `scroll-p*`, `basis`, `indent`, `leading`, plus borders,
ring, outline, stroke, font-size, border-radius and tracking — with negatives,
variant chains and `!important`.

## Custom themes

Your own design tokens win over the built-in scales.

**v4** — `--spacing-*`, `--text-*` and `--radius-*` in a CSS `@theme` block,
plus a custom `--spacing` base:

```css
@theme {
  --spacing: 4px;
  --spacing-gutter: 20px; /* p-20px       → p-gutter       */
  --text-hero: 58px;      /* text-58px    → text-hero      */
  --radius-card: 14px;    /* rounded-14px → rounded-card   */
}
```

**v3** — `theme.spacing`, `theme.fontSize` and `theme.borderRadius` (and their
`extend` counterparts) from `tailwind.config.{js,cjs,mjs,ts}`. `.js`/`.cjs`
configs are evaluated in an isolated child process, so no config code runs in
the editor; other formats are parsed without executing anything.

## Settings

| Setting                               | Default             | Description                                                                   |
| ------------------------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `pxToTwPlus.enabled`                  | `true`              | Master switch.                                                                |
| `pxToTwPlus.mode`                     | `"v4"`              | `"v4"` dynamic spacing or `"v3"` classic scale.                               |
| `pxToTwPlus.spacingBasePx`            | `4`                 | Base spacing unit (Tailwind `--spacing`). `value = px / base`.                |
| `pxToTwPlus.stepGranularity`          | `0.25`              | Smallest bare-class step in v4 (`1`, `0.5` or `0.25`).                        |
| `pxToTwPlus.arbitraryFor`             | `[]`                | Categories to always keep arbitrary — e.g. `["fontSize"]` keeps `text-[14px]`. |
| `pxToTwPlus.convertArbitraryBrackets` | `true`              | Reduce `p-[20px]` → `p-5`. Off = brackets left as-is, no highlight.           |
| `pxToTwPlus.ignoreFiles`              | `[]`                | Glob patterns; matching files are skipped entirely.                           |
| `pxToTwPlus.classFunctions`           | `["clsx", "cn", …]` | Class utilities whose string args count as class context.                     |
| `pxToTwPlus.supportedLanguages`       | all 12              | Languages where conversion runs.                                              |
| `pxToTwPlus.convertWhileTyping`       | `true`              | Convert live as you type.                                                     |
| `pxToTwPlus.convertOnSave`            | `false`             | Convert every px class in the file on save.                                   |
| `pxToTwPlus.showDiagnostics`          | `true`              | Highlight convertible classes (yellow) with a quick fix.                      |
| `pxToTwPlus.showVisualFeedback`       | `true`              | Briefly highlight converted ranges.                                           |
| `pxToTwPlus.showHoverTooltips`        | `true`              | Show px/rem values on hover.                                                  |

Languages: `html`, `javascript`, `javascriptreact`, `typescript`,
`typescriptreact`, `vue`, `svelte`, `astro`, `css`, `scss`, `less`, `postcss`.
In the CSS family only `@apply` rules are touched.

### Excluding files

`pxToTwPlus.ignoreFiles` takes **glob patterns** — the same syntax as
`.gitignore` and `files.exclude`. A matching file is skipped by every feature:
no live conversion, no convert-on-save, no diagnostics. Empty by default.

```jsonc
{
  "pxToTwPlus.ignoreFiles": [
    "**/*.{test,spec}.tsx", // test files anywhere
    "**/__tests__/**",      // whole test folders
    "/src/legacy/**",       // anchored at the workspace root
    "**/dist/**"            // build output
  ]
}
```

Patterns match the workspace-relative path; a leading `/` anchors to the root.
Separators are normalised, so one pattern works on every OS. An invalid pattern
is reported in the output channel and skipped — it never disables the others.

## Commands

| Command                                    | What it does                             |
| ------------------------------------------ | ---------------------------------------- |
| **Px to Tailwind Plus: Convert File**      | Convert every px class in the file.      |
| **Px to Tailwind Plus: Convert Selection** | Convert the selection only.              |
| **Px to Tailwind Plus: Toggle Extension**  | Enable/disable (also in the status bar). |
| **Px to Tailwind Plus: Show Logs**         | Open the output channel.                 |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
