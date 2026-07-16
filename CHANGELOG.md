# Changelog

All notable changes to **Px to Tailwind Plus** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-07-16

### Added

- `snapToNearestPx` setting (default `0`, off). Set a pixel budget and off-scale
  values offer the nearest scale token as a quick fix — `p-17px` → `p-4`,
  `text-21px` → `text-xl`, including the pasted bracket form `p-[17px]`.
  Snapping changes the rendered result, so it is never applied automatically:
  not while typing, not on save, not by *Convert File*. It surfaces as a blue
  hint with a "Snap to nearest" quick fix, distinct from the yellow exact-rewrite
  warning. Values pinned via `arbitraryFor`, values already on the scale, and
  candidates outside the budget are all left alone.

## [1.3.0] - 2026-07-16

### Added

- **rem input.** `p-1rem` and `p-[1.25rem]` become `p-4` / `p-5`,
  `text-[1.125rem]` becomes `text-lg`, resolved against the 16px root. A rem
  value is only rewritten when it lands on a scale token, so `p-[1.3rem]` stays
  as written instead of churning into `p-[20.8px]`. `em` is deliberately never
  converted — it resolves against the parent font size, which is not knowable
  from the text.
- **`@apply` in CSS/SCSS/Less/PostCSS.** `@apply p-16px mt-8px;` becomes
  `@apply p-4 mt-2;`. The CSS family is added to the default
  `supportedLanguages`; only `@apply` rules are touched, ordinary declarations
  like `padding: 16px` are left alone.
- **Custom theme font sizes and radii.** Previously only `--spacing` was read.
  Now v4 `@theme` `--text-*` and `--radius-*`, and v3 `theme.fontSize` /
  `theme.borderRadius` (plus their `extend` counterparts), map exact px matches
  to your own token names.
- **`ignoreFiles` setting.** Glob patterns, the same syntax as `.gitignore` and
  `files.exclude` (`**/*.test.ts`, `/src/legacy/**`). A matching file is skipped
  by every feature. Empty by default. Matched against the workspace-relative
  path, a leading `/` anchors to the workspace root, separators are normalised
  so one pattern works on every OS, and an invalid pattern is reported in the
  output channel instead of disabling the rest.

### Changed

- README rewritten around what the extension does rather than a feature list.

## [1.2.1] - 2026-07-15

### Fixed

- An apostrophe in ordinary prose (`There's`, `don't`, `It's`) no longer
  disables conversion and diagnostics for the rest of the file. Class-context
  detection counted quote parity across the document, so an apostrophe read as
  an unterminated string and everything after it looked like string content.
  Detection now anchors on the `class`/`className`/`:class` keyword or a
  recognised class-utility call and never counts quotes across the document.
  Affected diagnostics, convert-on-save, the bulk commands and live typing.

## [1.2.0] - 2026-07-15

### Added

- `convertArbitraryBrackets` setting (default on). Turn it off to leave the
  `[Npx]` bracket form untouched — no conversion and no diagnostic highlight for
  it. The bare suffix form (`p-20px`) is always converted.

## [1.1.0] - 2026-07-15

### Added

- Arbitrary bracket px classes are now reduced to their shortest scale token,
  e.g. `p-[20px]` → `p-5`, `text-[20px]` → `text-xl`. Works through diagnostics,
  the quick fix, convert-on-save and the bulk commands, and respects mode,
  project theme, custom spacing and `arbitraryFor` just like the bare form.

### Fixed

- Diagnostics no longer flag class-like text that sits inside ordinary string
  literals (e.g. `const s = '<div className="p-16px">'` in a `.ts` file). The
  bulk/diagnostics/save path now uses the same class-context detection as live
  typing, so all surfaces agree.

## [1.0.3] - 2026-07-15

### Changed

- Published under the `maksym-vasianin` marketplace publisher.

## [1.0.2] - 2026-07-15

### Added

- Live conversion now fires the moment the `px` unit is completed, not only on a
  boundary character.
- `convertWhileTyping` setting to turn live conversion off.
- `convertOnSave` setting to convert every px class in a file on save.
- `showDiagnostics` setting: convertible px classes are highlighted with a
  warning (yellow) and a "Convert to …" quick fix, plus a "Convert all in file"
  action.

## [1.0.1] - 2026-07-15

### Changed

- Marketplace README is now user-facing only; maintainer publishing and token
  setup moved to CONTRIBUTING.md.

## [1.0.0] - 2026-07-15

Initial release.

### Added

- Type-to-convert px classes inside `class`, `className`, `:class` and `class:`
  attributes across HTML, JS/TS, JSX/TSX, Vue, Svelte and Astro.
- **Tailwind v4** dynamic spacing with configurable base (`spacingBasePx`) and
  quarter/half/integer step granularity (`stepGranularity`).
- **Tailwind v3** classic fixed spacing scale with arbitrary-value fallback.
- Full property coverage: spacing utilities, borders, ring, outline, stroke,
  font-size, border-radius and tracking, with negatives and variant chains.
- Tailwind's dedicated `px` (1px) utility, e.g. `w-1px → w-px`.
- `arbitraryFor` setting to force categories (e.g. `fontSize`, `radius`) to
  arbitrary values.
- Custom theme awareness: `tailwind.config.*` (v3, sandboxed) and CSS `@theme`
  `--spacing-*` tokens plus a custom `--spacing` base (v4), cached and watched.
- Configurable `classFunctions` (clsx, cn, cva, …) as class context.
- Hover tooltips showing `property: Nrem /* Npx */`.
- Commands: Convert File, Convert Selection, Toggle Extension, Show Logs.
- Status bar toggle and brief visual feedback on conversion.

[1.0.3]: https://github.com/maximwas/px-to-tailwind-plus/releases/tag/v1.0.3
[1.0.2]: https://github.com/maximwas/px-to-tailwind-plus/releases/tag/v1.0.2
[1.0.1]: https://github.com/maximwas/px-to-tailwind-plus/releases/tag/v1.0.1
[1.0.0]: https://github.com/maximwas/px-to-tailwind-plus/releases/tag/v1.0.0
