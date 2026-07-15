import { convertToken, type ConverterOptions } from "./core";
import {
  DEFAULT_CLASS_FUNCTIONS,
  isClassAttributeContext,
  MAX_WINDOW_CHARS,
} from "./classContext";

export interface BulkConversion {
  /** Absolute start offset of the token within the source text. */
  start: number;
  /** Absolute end offset (exclusive). */
  end: number;
  original: string;
  output: string;
}

/**
 * Matches a candidate px token (with optional variant chain / negative sign)
 * anywhere in the text. The value is either the bare-suffix form (`16px`) or
 * the Tailwind arbitrary form (`[16px]`). convertToken and
 * isClassAttributeContext remain the source of truth for whether a match is a
 * real, convertible class utility.
 */
const PX_TOKEN_RE =
  /(?:[\w-]+:)*!?-?[a-z][\w-]*-(?:\d*\.?\d+px|\[\d*\.?\d+px\])/gi;

/**
 * Finds every convertible px token that sits inside a real class attribute (or
 * a recognised class-utility call) in `text`. The same context detector used by
 * live typing gates each candidate, so class-like text inside ordinary string
 * literals is left alone. Pure: returns offset-based edits the caller maps to
 * document positions.
 */
export function findConversions(
  text: string,
  options: ConverterOptions,
  classFunctions: string[] = DEFAULT_CLASS_FUNCTIONS,
): BulkConversion[] {
  const conversions: BulkConversion[] = [];

  PX_TOKEN_RE.lastIndex = 0;
  let token: RegExpExecArray | null;
  while ((token = PX_TOKEN_RE.exec(text)) !== null) {
    const original = token[0];
    const start = token.index;

    const result = convertToken(original, options);
    if (!result) {
      continue;
    }

    const windowStart = Math.max(0, start - MAX_WINDOW_CHARS);
    const prefix = text.slice(windowStart, start);
    if (!isClassAttributeContext(prefix, original, classFunctions)) {
      continue;
    }

    conversions.push({
      start,
      end: start + original.length,
      original,
      output: result.output,
    });
  }

  return conversions;
}
