/**
 * Pure conversion types. This module (and everything under src/core) must never
 * import `vscode` — it is unit-tested in isolation with Vitest.
 */

export type Mode = "v4" | "v3";

export type StepGranularity = 1 | 0.5 | 0.25;

/** How the numeric part of a class maps back to pixels. */
export type ValueKind = "spacing" | "direct" | "fontSize" | "radius" | "tracking";

export interface ConverterOptions {
  mode: Mode;
  /** Tailwind's `--spacing` base in px (v4 dynamic spacing). value = px / base. */
  spacingBasePx: number;
  /** Smallest bare-class step allowed in v4 mode. */
  stepGranularity: StepGranularity;
  /**
   * Custom spacing tokens from a project theme, keyed by class name → px.
   * v3: parsed from `theme.spacing` / `theme.extend.spacing`.
   * v4: parsed from `--spacing-*` tokens in `@theme` blocks.
   * Exact px matches take precedence over the default scale.
   */
  customSpacing?: Record<string, number>;
  /**
   * Custom font-size tokens, keyed by class name → px.
   * v3: `theme.fontSize`. v4: `--text-*` tokens in `@theme`.
   */
  customFontSize?: Record<string, number>;
  /**
   * Custom border-radius tokens, keyed by class name → px.
   * v3: `theme.borderRadius`. v4: `--radius-*` tokens in `@theme`.
   */
  customRadius?: Record<string, number>;
  /**
   * Categories that should always emit arbitrary `[Npx]` values instead of
   * named/scale tokens (e.g. force `text-[14px]` rather than `text-sm`).
   */
  arbitraryFor?: ValueKind[];
  /**
   * Whether to reduce the arbitrary bracket form (`p-[20px]` → `p-5`). The bare
   * suffix form (`p-20px`) is always converted. Defaults to true when omitted.
   */
  convertArbitraryBrackets?: boolean;
}

export interface ConversionResult {
  /** The original token, e.g. `p-16px`. */
  input: string;
  /** The converted token, e.g. `p-4`. */
  output: string;
  /** True when the output uses an arbitrary value, e.g. `w-[50.5px]`. */
  isArbitrary: boolean;
  /** The utility property, e.g. `p`, `mt`, `border-t`. */
  property: string;
  category: ValueKind;
  /** Signed pixel value that was converted. */
  px: number;
}

/** Reverse description of a Tailwind class, used by the hover provider. */
export interface ClassDescription {
  property: string;
  /** Human CSS property, e.g. `padding`, `padding-inline`. */
  cssProperty: string;
  px: number;
  rem: number;
  isArbitrary: boolean;
}
