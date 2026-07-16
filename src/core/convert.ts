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
  /** Signed pixel value, with rem already normalised against the root. */
  px: number;
  /** True when the input used the arbitrary bracket form, e.g. `p-[20px]`. */
  bracket: boolean;
  /** The unit exactly as written. */
  unit: "px" | "rem";
}

// Bare-suffix form (`p-16px`) and the equivalent Tailwind arbitrary form
// (`p-[16px]`). Both feed the same conversion; the bracket form is reduced to
// the shortest scale token, e.g. `p-[20px]` → `p-5`.
//
// `rem` is accepted and normalised against the 16px root. `em` deliberately is
// not: it resolves against the *parent* font size, which is not knowable from
// the text, so any conversion would be a guess.
const TOKEN_RE = /^(.+)-(\d*\.?\d+)(px|rem)$/;
const BRACKET_TOKEN_RE = /^(.+)-\[(\d*\.?\d+)(px|rem)\]$/;

/** CSS root font size assumed for rem → px, matching Tailwind's own default. */
const ROOT_FONT_SIZE_PX = 16;

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

  const bareMatch = util.match(TOKEN_RE);
  const match = bareMatch ?? util.match(BRACKET_TOKEN_RE);
  if (!match) {
    return null;
  }

  const property = match[1];
  const rawNum = match[2];
  const unit = match[3] as "px" | "rem";
  const value = parseFloat(rawNum);
  if (!Number.isFinite(value)) {
    return null;
  }

  const magnitude = unit === "rem" ? value * ROOT_FONT_SIZE_PX : value;

  return {
    variantPrefix,
    important,
    negative,
    property,
    rawNum,
    px: negative ? -magnitude : magnitude,
    bracket: bareMatch === null,
    unit,
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

  // The bracket form is opt-out; the bare suffix form is always converted.
  if (parsed.bracket && opts.convertArbitraryBrackets === false) {
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

  // A rem value is only worth rewriting when it lands on a scale token. Falling
  // back to an arbitrary value would just churn `p-[1.3rem]` into `p-[20.8px]`.
  if (parsed.unit === "rem" && built.isArbitrary) {
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
  const magnitude = Math.abs(parsed.px);

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

  if (opts.arbitraryFor?.includes(def.category)) {
    return arbitrary();
  }

  switch (def.category) {
    case "spacing": {
      const customEligible =
        opts.customSpacing && !(opts.mode === "v3" && def.v4Only);
      if (customEligible) {
        const name = findCustomToken(opts.customSpacing, magnitude);
        if (name !== null) {
          return scaled(name);
        }
      }

      // Tailwind's dedicated 1px utility, e.g. `w-px`, `-mt-px`.
      if (magnitude === 1) {
        return scaled("px");
      }

      if (opts.mode === "v3") {
        if (def.v4Only) {
          return arbitrary();
        }
        const scale = V3_SPACING_PX_TO_SCALE.get(magnitude);
        return scale !== undefined ? scaled(scale) : arbitrary();
      }

      // v4 dynamic spacing.
      const base = opts.spacingBasePx > 0 ? opts.spacingBasePx : 4;
      const value = magnitude / base;
      return isMultipleOf(value, opts.stepGranularity)
        ? scaled(formatScale(value))
        : arbitrary();
    }

    case "direct": {
      if (!isInteger(magnitude)) {
        return arbitrary();
      }
      const allowed = opts.mode === "v3" ? V3_DIRECT_PX.has(magnitude) : true;
      if (!allowed) {
        return arbitrary();
      }
      if (def.bareAtOne && magnitude === 1) {
        return scaled("");
      }
      return scaled(String(magnitude));
    }

    case "fontSize": {
      const custom = findCustomToken(opts.customFontSize, magnitude);
      if (custom !== null) {
        return scaled(custom);
      }
      const name = isInteger(magnitude) ? FONT_SIZE_PX_TO_NAME.get(magnitude) : undefined;
      return name !== undefined ? scaled(name) : arbitrary();
    }

    case "radius": {
      const custom = findCustomToken(opts.customRadius, magnitude);
      if (custom !== null) {
        return scaled(custom);
      }
      const map = opts.mode === "v4" ? RADIUS_V4_PX_TO_NAME : RADIUS_V3_PX_TO_NAME;
      const name = isInteger(magnitude) ? map.get(magnitude) : undefined;
      return name !== undefined ? scaled(name) : arbitrary();
    }

    case "tracking":
      return arbitrary();

    default:
      return null;
  }
}

/** Finds a custom theme token name whose px matches `px` exactly. */
function findCustomToken(
  custom: Record<string, number> | undefined,
  px: number,
): string | null {
  if (!custom) {
    return null;
  }
  for (const [name, value] of Object.entries(custom)) {
    if (Math.abs(value - px) < 1e-9) {
      return name;
    }
  }
  return null;
}
