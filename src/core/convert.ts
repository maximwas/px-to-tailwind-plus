import { getPropertyDef, type PropertyDef } from "./categories";
import {
  FONT_SIZE_PX_TO_NAME,
  RADIUS_V3_PX_TO_NAME,
  RADIUS_V4_PX_TO_NAME,
  V3_DIRECT_PX,
  V3_SPACING_PX_TO_SCALE,
  formatScale,
  isInteger,
  isMultipleOf,
} from "./scale";
import type { ConversionResult, ConverterOptions } from "./types";

/** A token stripped into its structural parts. */
export interface ParsedToken {
  /** Everything up to and including the last `:` (variant chain), or "". */
  variantPrefix: string;
  /** "!" for important, else "". */
  important: string;
  negative: boolean;
  property: string;
  /** The raw numeric text exactly as typed, e.g. "50.5". */
  rawNum: string;
  /** Signed pixel value. */
  px: number;
}

const TOKEN_RE = /^(.+)-(\d*\.?\d+)px$/;

/**
 * Parses a candidate class token like `md:-mt-8px` into its parts.
 * Returns null when the token is not a `<prop>-<num>px` utility.
 */
export function parseToken(token: string): ParsedToken | null {
  if (!token || token.length > 200) {
    return null;
  }

  const lastColon = token.lastIndexOf(":");
  let variantPrefix = "";
  let util = token;
  if (lastColon !== -1) {
    variantPrefix = token.slice(0, lastColon + 1);
    util = token.slice(lastColon + 1);
  }

  let important = "";
  if (util.startsWith("!")) {
    important = "!";
    util = util.slice(1);
  }

  let negative = false;
  if (util.startsWith("-")) {
    negative = true;
    util = util.slice(1);
  }

  const m = util.match(TOKEN_RE);
  if (!m) {
    return null;
  }

  const property = m[1];
  const rawNum = m[2];
  const magnitude = parseFloat(rawNum);
  if (!Number.isFinite(magnitude)) {
    return null;
  }

  return {
    variantPrefix,
    important,
    negative,
    property,
    rawNum,
    px: negative ? -magnitude : magnitude,
  };
}

/**
 * Converts a single class token to its Tailwind equivalent, or null when the
 * token is not a supported px utility. Pure and side-effect free.
 */
export function convertToken(
  token: string,
  opts: ConverterOptions,
): ConversionResult | null {
  const parsed = parseToken(token);
  if (!parsed) {
    return null;
  }

  const def = getPropertyDef(parsed.property);
  if (!def) {
    return null;
  }

  if (parsed.negative && !def.allowNegative) {
    return null;
  }

  const built = buildOutput(parsed, def, opts);
  if (built === null) {
    return null;
  }

  const output = parsed.variantPrefix + parsed.important + built.body;
  if (output === token) {
    return null;
  }

  return {
    input: token,
    output,
    isArbitrary: built.isArbitrary,
    property: parsed.property,
    category: def.category,
    px: parsed.px,
  };
}

interface BuiltBody {
  body: string;
  isArbitrary: boolean;
}

function buildOutput(
  parsed: ParsedToken,
  def: PropertyDef,
  opts: ConverterOptions,
): BuiltBody | null {
  const { property, negative, rawNum } = parsed;
  const mag = Math.abs(parsed.px);

  const bare = (value: string): string =>
    value === ""
      ? `${negative ? "-" : ""}${property}`
      : `${negative ? "-" : ""}${property}-${value}`;
  const arbitrary = (): BuiltBody => ({
    body: `${negative ? "-" : ""}${property}-[${rawNum}px]`,
    isArbitrary: true,
  });
  const scaled = (value: string): BuiltBody => ({
    body: bare(value),
    isArbitrary: false,
  });

  switch (def.category) {
    case "spacing": {
      const customEligible =
        opts.customSpacing && !(opts.mode === "v3" && def.v4Only);
      if (customEligible) {
        const name = findCustomSpacing(opts.customSpacing!, mag);
        if (name !== null) {
          return scaled(name);
        }
      }

      if (opts.mode === "v3") {
        if (def.v4Only) {
          return arbitrary();
        }
        const scale = V3_SPACING_PX_TO_SCALE.get(mag);
        return scale !== undefined ? scaled(scale) : arbitrary();
      }

      // v4 dynamic spacing.
      const base = opts.spacingBasePx > 0 ? opts.spacingBasePx : 4;
      const value = mag / base;
      return isMultipleOf(value, opts.stepGranularity)
        ? scaled(formatScale(value))
        : arbitrary();
    }

    case "direct": {
      if (!isInteger(mag)) {
        return arbitrary();
      }
      const allowed = opts.mode === "v3" ? V3_DIRECT_PX.has(mag) : true;
      if (!allowed) {
        return arbitrary();
      }
      if (def.bareAtOne && mag === 1) {
        return scaled("");
      }
      return scaled(String(mag));
    }

    case "fontSize": {
      const name = isInteger(mag) ? FONT_SIZE_PX_TO_NAME.get(mag) : undefined;
      return name !== undefined ? scaled(name) : arbitrary();
    }

    case "radius": {
      const map = opts.mode === "v4" ? RADIUS_V4_PX_TO_NAME : RADIUS_V3_PX_TO_NAME;
      const name = isInteger(mag) ? map.get(mag) : undefined;
      return name !== undefined ? scaled(name) : arbitrary();
    }

    case "tracking":
      return arbitrary();

    default:
      return null;
  }
}

/** Finds a custom spacing token name whose px matches `px` exactly. */
function findCustomSpacing(
  custom: Record<string, number>,
  px: number,
): string | null {
  for (const [name, value] of Object.entries(custom)) {
    if (Math.abs(value - px) < 1e-9) {
      return name;
    }
  }
  return null;
}
