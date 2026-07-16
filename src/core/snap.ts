import { getPropertyDef, type PropertyDef } from "./categories";
import { convertToken, parseToken } from "./convert";
import {
  FONT_SIZE_PX_TO_NAME,
  RADIUS_V3_PX_TO_NAME,
  RADIUS_V4_PX_TO_NAME,
  V3_DIRECT_PX,
  V3_SPACING_PX_TO_SCALE,
} from "./scale";
import type { ConverterOptions } from "./types";

/** A nearby scale token offered for an off-scale value. */
export interface SnapSuggestion {
  /** The snapped token, e.g. `p-4`. */
  output: string;
  /** The pixel value snapped to. */
  px: number;
  /** The pixel value that was written. */
  fromPx: number;
}

/**
 * Suggests the nearest scale token for a value that would otherwise stay an
 * arbitrary one, e.g. `p-17px` → `p-4` on the v3 scale.
 *
 * This is a suggestion only — it changes the rendered result by up to
 * `snapToNearestPx`, so it is surfaced as a quick fix and never applied on save
 * or while typing. Disabled unless `snapToNearestPx` is greater than zero.
 */
export function findSnapSuggestion(
  token: string,
  opts: ConverterOptions,
): SnapSuggestion | null {
  const budget = opts.snapToNearestPx ?? 0;
  if (!(budget > 0)) {
    return null;
  }

  const parsed = parseToken(token);
  if (!parsed) {
    return null;
  }

  const def = getPropertyDef(parsed.property);
  if (!def || (parsed.negative && !def.allowNegative)) {
    return null;
  }

  // The value was deliberately kept arbitrary — do not second-guess that.
  if (opts.arbitraryFor?.includes(def.category)) {
    return null;
  }

  // Only off-scale values need snapping; anything that already reduces to a
  // bare token is left alone.
  const asWritten = convertToken(token, opts);
  if (asWritten && !asWritten.isArbitrary) {
    return null;
  }

  const magnitude = Math.abs(parsed.px);
  const nearest = findNearest(candidatesFor(def, opts, magnitude), magnitude);
  if (nearest === null || nearest === magnitude) {
    return null;
  }
  if (Math.abs(nearest - magnitude) > budget) {
    return null;
  }

  // Reuse the normal conversion so the snapped token honours mode, theme and
  // every other option exactly as a hand-written value would.
  const rebuilt = `${parsed.variantPrefix}${parsed.important}${
    parsed.negative ? "-" : ""
  }${parsed.property}-${nearest}px`;
  const result = convertToken(rebuilt, opts);
  if (!result || result.isArbitrary) {
    return null;
  }

  return { output: result.output, px: nearest, fromPx: magnitude };
}

/**
 * The pixel values reachable as bare tokens for this property, or null when the
 * category has no scale to snap to.
 */
function candidatesFor(
  def: PropertyDef,
  opts: ConverterOptions,
  magnitude: number,
): number[] | null {
  switch (def.category) {
    case "spacing": {
      if (opts.mode === "v3") {
        if (def.v4Only) {
          return null;
        }
        return [
          1, // Tailwind's dedicated `px` utility
          ...V3_SPACING_PX_TO_SCALE.keys(),
          ...customValues(opts.customSpacing),
        ];
      }
      // v4 is a continuous scale: the nearest reachable value is the closest
      // multiple of one allowed step.
      const base = opts.spacingBasePx > 0 ? opts.spacingBasePx : 4;
      const step = base * opts.stepGranularity;
      return [
        1,
        Math.round(magnitude / step) * step,
        ...customValues(opts.customSpacing),
      ];
    }

    case "fontSize":
      return [
        ...FONT_SIZE_PX_TO_NAME.keys(),
        ...customValues(opts.customFontSize),
      ];

    case "radius":
      return [
        ...(opts.mode === "v4" ? RADIUS_V4_PX_TO_NAME : RADIUS_V3_PX_TO_NAME).keys(),
        ...customValues(opts.customRadius),
      ];

    case "direct":
      return opts.mode === "v3"
        ? [...V3_DIRECT_PX]
        : [Math.round(magnitude)];

    // Tracking is always emitted as an arbitrary value, so there is no scale.
    case "tracking":
    default:
      return null;
  }
}

const customValues = (custom?: Record<string, number>): number[] =>
  custom ? Object.values(custom) : [];

/** Nearest candidate to `value`; ties resolve to the smaller value. */
function findNearest(candidates: number[] | null, value: number): number | null {
  if (!candidates || candidates.length === 0) {
    return null;
  }
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance < bestDistance || (distance === bestDistance && candidate < best!)) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}
