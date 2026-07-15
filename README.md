# Px to Tailwind Plus

Convert pixel values to Tailwind CSS classes **as you type**. Type `p-16px` and
the moment you hit space it becomes `p-4`. Works with **Tailwind v4** dynamic
spacing (quarter-step scale) and **Tailwind v3** classic scale, in **VS Code**
and **Cursor**.

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/maksym-vasianin.px-to-tailwind-plus?label=VS%20Marketplace&color=0EA5E9)](https://marketplace.visualstudio.com/items?itemName=maksym-vasianin.px-to-tailwind-plus)
[![Open VSX](https://img.shields.io/open-vsx/v/maksym-vasianin/px-to-tailwind-plus?label=Open%20VSX&color=0891B2)](https://open-vsx.org/extension/maksym-vasianin/px-to-tailwind-plus)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## Features

- **Type-to-convert** inside `class`, `className`, `:class` and `class:`
  attributes — fires the moment you finish the `px` unit (or type a space,
  quote, backtick, `}` or newline).
- **Yellow highlight + quick fix** — convertible px classes are flagged with a
  warning and a one-click "Convert to …" fix (great for pasted code).
- **Convert on save** — optionally rewrite every px class in the file on save.
- **Tailwind v4 dynamic spacing** — `p-13px → p-3.25`, `p-18px → p-4.5`,
  `w-200px → w-50`, with a configurable base and quarter/half/integer steps.
- **Tailwind v3 classic scale** — maps to the fixed scale, everything else
  becomes an arbitrary value.
- **Every spacing utility** — padding, margin, `gap`, `w/h/size`, `min-*`,
  `max-*`, inset, `translate-*`, `space-*`, `scroll-m*`, `scroll-p*`, `basis`,
  `indent`, `leading`, plus borders, ring, outline, stroke, font-size, radius
  and tracking.
- **Negatives, variants and important** — `-mt-8px → -mt-2`, `md:p-16px → md:p-4`.
- **Reduces arbitrary brackets** — already-written `p-[20px] → p-5`,
  `text-[20px] → text-xl`; irreducible or non-px brackets are left alone.
- **Arbitrary fallback** — off-scale values become `w-[50.5px]`.
- **Custom theme aware** — reads `tailwind.config.*` (v3) and CSS `@theme`
  `--spacing-*` tokens (v4); exact px matches map to your named tokens.
- **Hover tooltips** — hover `p-4` to see `padding: 1rem /* 16px */`.
- **Commands, status bar and visual feedback.**

## Examples

Tailwind v4 (default, base `4px`, quarter steps):

| You type      | You get       |
| ------------- | ------------- |
| `p-16px`      | `p-4`         |
| `px-13px`     | `px-3.25`     |
| `p-18px`      | `p-4.5`       |
| `-mt-8px`     | `-mt-2`       |
| `w-1px`       | `w-px`        |
| `w-50.5px`    | `w-[50.5px]`  |
| `text-14px`   | `text-sm`     |
| `rounded-8px` | `rounded-lg`  |
| `border-2px`  | `border-2`    |

Tailwind v3 (classic fixed scale):

| You type      | You get        |
| ------------- | -------------- |
| `p-16px`      | `p-4`          |
| `p-13px`      | `p-[13px]`     |
| `rounded-4px` | `rounded`      |
| `border-3px`  | `border-[3px]` |

Already-written arbitrary brackets are reduced to the shortest token too (same
scale, mode, theme and settings as the bare form):

| You type      | You get       |
| ------------- | ------------- |
| `p-[20px]`    | `p-5`         |
| `text-[20px]` | `text-xl`     |
| `gap-[12px]`  | `gap-3`       |
| `p-[7.3px]`   | `p-[7.3px]`   |

## Installation

### VS Code

Search **“Px to Tailwind Plus”** in the Extensions view, or:

```
ext install maksym-vasianin.px-to-tailwind-plus
```

### Cursor

Cursor installs from the **Open VSX** registry. Search **“Px to Tailwind Plus”**
in Cursor’s Extensions view, or download the `.vsix` from the
[Open VSX page](https://open-vsx.org/extension/maksym-vasianin/px-to-tailwind-plus)
and run **Extensions: Install from VSIX…**.

## Modes

Set `pxToTwPlus.mode`:

- **`v4`** (default) — dynamic spacing. `value = px / spacingBasePx`. If the
  value lands on the allowed step granularity it becomes a bare class
  (`p-3.25`), otherwise an arbitrary value (`p-[13px]`). Emitted quarter-step
  classes render as `calc(var(--spacing) * N)` and are valid Tailwind v4.
- **`v3`** — the classic fixed spacing scale. Off-scale values become arbitrary.

## Settings

| Setting                         | Default             | Description                                                                    |
| ------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `pxToTwPlus.enabled`            | `true`              | Enable/disable conversion.                                                     |
| `pxToTwPlus.mode`               | `"v4"`              | `"v4"` dynamic spacing or `"v3"` classic scale.                                |
| `pxToTwPlus.spacingBasePx`      | `4`                 | Base spacing unit (Tailwind `--spacing`). `value = px / base`.                 |
| `pxToTwPlus.stepGranularity`    | `0.25`              | Smallest bare-class step in v4 (`1`, `0.5` or `0.25`).                         |
| `pxToTwPlus.arbitraryFor`       | `[]`                | Categories to always keep arbitrary — e.g. `["fontSize"]` keeps `text-[14px]`. |
| `pxToTwPlus.classFunctions`     | `["clsx", "cn", …]` | Class-utility functions whose string args count as class context.             |
| `pxToTwPlus.convertWhileTyping` | `true`              | Convert live as you type. Turn off to convert only via quick fix or on save.   |
| `pxToTwPlus.convertOnSave`      | `false`             | Convert every px class in the file on save.                                    |
| `pxToTwPlus.showDiagnostics`    | `true`              | Highlight convertible px classes (yellow) with a quick fix.                     |
| `pxToTwPlus.supportedLanguages` | all 8 languages     | Languages where conversion runs.                                              |
| `pxToTwPlus.showVisualFeedback` | `true`              | Briefly highlight converted ranges.                                            |
| `pxToTwPlus.showHoverTooltips`  | `true`              | Show px/rem values on hover.                                                   |

Supported languages: `html`, `javascript`, `javascriptreact`, `typescript`,
`typescriptreact`, `vue`, `svelte`, `astro`.

## Custom theme awareness

- **v3** — if a `tailwind.config.{js,cjs,mjs,ts}` exists, `theme.spacing` and
  `theme.extend.spacing` are read; exact px matches map to your token
  (`{ sm: '6px' }` → `p-6px` becomes `p-sm`). `.js`/`.cjs` configs are evaluated
  in an isolated child process (never in the editor); `.ts`/`.mjs` use a safe
  regex parser and support only simple object literals.
- **v4** — CSS `@theme` blocks are scanned for `--spacing-*` tokens and a custom
  `--spacing` base (e.g. in `globals.css`).

Theme data is cached and refreshed automatically when those files change.

## Commands

Open the Command Palette and search “Px to Tailwind Plus”:

- **Convert File** — convert every px class in the active file.
- **Convert Selection** — convert within the selection(s).
- **Toggle Extension** — enable/disable (also from the status bar).
- **Show Logs** — open the output channel.

## Contributing

Issues and pull requests are welcome. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the development, testing and release
workflow.

## License

[MIT](./LICENSE)
