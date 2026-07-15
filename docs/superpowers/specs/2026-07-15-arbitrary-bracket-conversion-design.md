# Arbitrary bracket px conversion

**Date:** 2026-07-15
**Status:** Approved (scope A)

## Goal

Teach the converter to reduce arbitrary bracket px utilities to their shortest
Tailwind scale token, e.g. `p-[20px]` → `p-5`, `text-[20px]` → `text-xl`,
reusing the existing conversion, theme, and mode logic.

Today the extension only recognises the bare-suffix form `p-20px`. The bracket
form `p-[20px]` (valid Tailwind arbitrary syntax) is ignored everywhere.

## Scope

**In (scope A):**

- Diagnostics: convertible bracket px classes are flagged (yellow) with a quick fix.
- Convert-on-save rewrites bracket px classes.
- Bulk "Convert all in file" / convert-selection commands handle bracket px.

**Out:**

- Live conversion of the bracket form while typing (deferred; the bracket
  closer `]` needs its own change-handler trigger — see "Deferred" below).
- Non-px units inside brackets (`p-[1.25rem]`, `w-[50%]`, `w-[calc(...)]`).
  The matcher only accepts a pure `[<number>px]` value.
- Hover changes: `p-[20px]` is valid Tailwind, so the platform already describes it.

## Why this is small

The whole conversion pipeline operates on a *parsed token* and is agnostic to
input syntax. Every VS Code surface (diagnostics, save, bulk, quick fix) routes
through `findConversions` → `convertToken`. So bracket support is two matcher
widenings plus tests; the scale math, theme lookup, mode handling, and
`arbitraryFor` behaviour are reused unchanged.

## Changes

### 1. Core parser — `src/core/convert.ts`

`parseToken` currently matches only `TOKEN_RE = /^(.+)-(\d*\.?\d+)px$/`.
Add a second recognised shape for the bracket form, extracting the same fields
(`property`, `rawNum`, `px`). Everything downstream (`buildOutput`, output
assembly, the `output === token` no-op guard) is unchanged.

Variant chains, `!` important, and the negative sign are stripped before the
value is matched today; that stays, so `md:-mt-[20px]` and `!p-[20px]` parse
correctly and reassemble as `md:-mt-5` / `!p-5`.

### 2. Token scanner — `src/bulkConvert.ts`

`PX_TOKEN_RE` finds candidate tokens inside class attribute values and drives
diagnostics, save, and the bulk commands in one place. Widen it so the value
part matches either `Ndpx` or `[Npx]`:

```
value := \d*\.?\d+px  |  \[\d*\.?\d+px\]
```

`convertToken` stays the source of truth for whether a match actually converts.

### 2b. Unify class-context detection — `src/bulkConvert.ts`

`findConversions` today trusts `CLASS_VALUE_RE` alone, which matches
`className="…"` even when it sits inside an ordinary string literal — e.g. the
test data `const input = '<div className="p-16px">'` in a `.ts` file. That
produces false diagnostics on class-like text that is not a real class
attribute. Live typing already avoids this via `isClassAttributeContext`
(`src/classContext.ts`); the bulk/diagnostics/save path does not.

Fix: route every candidate token through `isClassAttributeContext` — the same
detector live typing uses — so all surfaces agree. No file-name, language, or
"skip test files" special-casing; correctness comes purely from where the token
actually sits (inside a real class attribute / recognised class-utility call).

- `findConversions` gains a `classFunctions: string[]` argument, threaded from
  settings by its three callers (`diagnostics.ts`, `saveHandler.ts`,
  `commands.ts`).
- Candidate scan runs `PX_TOKEN_RE` over the text; each hit is gated by
  `isClassAttributeContext(prefixWindow, token, classFunctions)` before it is
  emitted, using a bounded lookback window (`MAX_WINDOW_CHARS`).

Verified against existing behaviour: real JSX/HTML `className="…"` still
converts; `const label = "p-16px"` still does not; and the `.ts` test-string
false positive disappears.

### 3. Tests — `test/convert.test.ts`, `test/bulkConvert.test.ts`

Add bracket-form cases covering:

- v4 dynamic spacing: `p-[20px]` → `p-5`, `p-[7px]` → `p-1.75`.
- v3 scale: `p-[20px]` → `p-5`; non-scale px stays arbitrary (no-op).
- font-size: `text-[20px]` → `text-xl`.
- custom `--spacing` token: `p-[20px]` → named token.
- `arbitraryFor` includes the category → left untouched (no-op).
- negative / important / variant: `md:-mt-[20px]` → `md:-mt-5`, `!p-[20px]` → `!p-5`.
- irreducible value: `p-[7.3px]` stays `p-[7.3px]` (no diagnostic).
- non-px bracket: `p-[1.25rem]`, `w-[50%]` ignored.

## Behaviour that falls out for free

- **`arbitraryFor`**: for a forced-arbitrary category, `buildOutput` returns the
  same `p-[20px]`, and the `output === token` guard drops it as a no-op. What the
  user intentionally kept arbitrary is never touched — no special-casing needed.
- **Irreducible values** reduce to `arbitrary()` == input → no-op → no false
  diagnostic.
- **Theme / mode**: `opts` already carry `mode`, `customSpacing`, `spacingBasePx`,
  `stepGranularity`, `arbitraryFor`. The bracket form flows through identical
  options, so v3/v4 and project themes work automatically.

## Deferred: live typing (scope B)

To also convert the bracket form as it is typed, `src/changeHandler.ts` would
need: `]` added as a completion trigger, and the `token.endsWith("px")` guard
relaxed to also accept `px]`. `TOKEN_STOPS` already excludes `[` and `]`, so the
backward token scan is already correct. Not included in this iteration.

## Risks

- Widening `PX_TOKEN_RE` must not change bare-form matching. Mitigated by keeping
  the existing alternative intact and adding the bracket alternative beside it,
  with regression cases for `p-20px` retained.
