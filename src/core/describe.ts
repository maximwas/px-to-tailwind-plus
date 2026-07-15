import { getPropertyDef } from "./categories";
import { V3_SCALE_TO_PX } from "./scale";
import type { ClassDescription, ConverterOptions } from "./types";

const ARBITRARY_RE = /^(.+)-\[(-?\d*\.?\d+)px\]$/;
const SCALE_RE = /^(.+)-([A-Za-z0-9.]+)$/;

/**
 * Describes a spacing-family Tailwind class in reverse (class → px/rem),
 * powering hover tooltips. Returns null for classes we can't resolve.
 */
export function describeClass(
  token: string,
  opts: ConverterOptions,
): ClassDescription | null {
  // Strip variant chain, important marker and negative sign.
  const lastColon = token.lastIndexOf(":");
  let util = lastColon !== -1 ? token.slice(lastColon + 1) : token;
  if (util.startsWith("!")) {
    util = util.slice(1);
  }
  let negative = false;
  if (util.startsWith("-")) {
    negative = true;
    util = util.slice(1);
  }

  const base = opts.spacingBasePx > 0 ? opts.spacingBasePx : 4;

  // Arbitrary value: `w-[50.5px]`, `mt-[-3px]`.
  const arb = util.match(ARBITRARY_RE);
  if (arb) {
    const def = getPropertyDef(arb[1]);
    if (!def || def.category !== "spacing") {
      return null;
    }
    const raw = parseFloat(arb[2]);
    if (!Number.isFinite(raw)) {
      return null;
    }
    const px = negative ? -Math.abs(raw) : raw;
    return build(arb[1], def.cssProperty, px, true);
  }

  // Named / numeric scale: `p-4`, `px-3.25`, `p-sm`.
  const scale = util.match(SCALE_RE);
  if (!scale) {
    return null;
  }
  const property = scale[1];
  const valueToken = scale[2];
  const def = getPropertyDef(property);
  if (!def || def.category !== "spacing") {
    return null;
  }

  let mag: number | null = null;
  if (opts.customSpacing && opts.customSpacing[valueToken] !== undefined) {
    mag = opts.customSpacing[valueToken];
  } else {
    const num = parseFloat(valueToken);
    if (Number.isFinite(num)) {
      if (opts.mode === "v3") {
        mag = V3_SCALE_TO_PX.get(valueToken) ?? num * base;
      } else {
        mag = num * base;
      }
    }
  }

  if (mag === null) {
    return null;
  }

  const px = negative ? -mag : mag;
  return build(property, def.cssProperty, px, false);
}

function build(
  property: string,
  cssProperty: string,
  px: number,
  isArbitrary: boolean,
): ClassDescription {
  return { property, cssProperty, px, rem: px / 16, isArbitrary };
}
