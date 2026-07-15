import type { StepGranularity } from "./types";

/** Floating-point tolerance for equality checks. */
const EPSILON = 1e-9;

/**
 * Tailwind v3 classic spacing scale: px → scale token.
 * Values taken directly from the default Tailwind v3 theme.
 */
export const V3_SPACING_PX_TO_SCALE: ReadonlyMap<number, string> = new Map([
  [0, "0"],
  [2, "0.5"],
  [4, "1"],
  [6, "1.5"],
  [8, "2"],
  [10, "2.5"],
  [12, "3"],
  [14, "3.5"],
  [16, "4"],
  [20, "5"],
  [24, "6"],
  [28, "7"],
  [32, "8"],
  [36, "9"],
  [40, "10"],
  [44, "11"],
  [48, "12"],
  [56, "14"],
  [64, "16"],
  [80, "20"],
  [96, "24"],
  [112, "28"],
  [128, "32"],
  [144, "36"],
  [160, "40"],
  [176, "44"],
  [192, "48"],
  [208, "52"],
  [224, "56"],
  [240, "60"],
  [256, "64"],
  [288, "72"],
  [320, "80"],
  [384, "96"],
]);

/** Reverse of {@link V3_SPACING_PX_TO_SCALE}: scale token → px. */
export const V3_SCALE_TO_PX: ReadonlyMap<string, number> = new Map(
  [...V3_SPACING_PX_TO_SCALE].map(([px, scale]) => [scale, px]),
);

/** Direct px values allowed as bare classes in v3 (borders, ring, outline…). */
export const V3_DIRECT_PX = new Set([0, 1, 2, 4, 8]);

/** Font-size px → Tailwind named size (shared across v3/v4). */
export const FONT_SIZE_PX_TO_NAME: ReadonlyMap<number, string> = new Map([
  [12, "xs"],
  [14, "sm"],
  [16, "base"],
  [18, "lg"],
  [20, "xl"],
  [24, "2xl"],
  [30, "3xl"],
  [36, "4xl"],
  [48, "5xl"],
  [60, "6xl"],
  [72, "7xl"],
  [96, "8xl"],
  [128, "9xl"],
]);

/** Border-radius px → named token. An empty string means the bare class. */
export const RADIUS_V4_PX_TO_NAME: ReadonlyMap<number, string> = new Map([
  [2, "xs"],
  [4, "sm"],
  [6, "md"],
  [8, "lg"],
  [12, "xl"],
  [16, "2xl"],
  [24, "3xl"],
  [32, "4xl"],
]);

export const RADIUS_V3_PX_TO_NAME: ReadonlyMap<number, string> = new Map([
  [2, "sm"],
  [4, ""],
  [6, "md"],
  [8, "lg"],
  [12, "xl"],
  [16, "2xl"],
  [24, "3xl"],
]);

/** True when `value` is an integer multiple of `step` (within tolerance). */
export function isMultipleOf(value: number, step: StepGranularity): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < EPSILON;
}

/** True when `value` is a whole number (within tolerance). */
export function isInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < EPSILON;
}

/**
 * Formats a numeric scale value minimally: 50 → "50", 4.5 → "4.5",
 * 3.25 → "3.25", 0.25 → "0.25". Avoids floating-point artifacts.
 */
export function formatScale(value: number): string {
  return parseFloat(value.toFixed(4)).toString();
}
