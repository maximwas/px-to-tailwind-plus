import { convertToken, type ConverterOptions } from "./core";

export interface BulkConversion {
  /** Absolute start offset of the token within the source text. */
  start: number;
  /** Absolute end offset (exclusive). */
  end: number;
  original: string;
  output: string;
}

/** Matches class attribute values and captures the quote + inner content. */
const CLASS_VALUE_RE =
  /(?:class(?:Name)?|:class|v-bind:class)\s*=\s*(["'`])([\s\S]*?)\1/g;

/**
 * Matches a candidate px token (with optional variant chain / negative sign)
 * anywhere inside class content, ignoring surrounding quotes and punctuation.
 * convertToken remains the source of truth for whether a match is valid.
 */
const PX_TOKEN_RE = /(?:[\w-]+:)*!?-?[a-z][\w-]*-\d*\.?\d+px/gi;

/**
 * Finds every convertible px token inside class attribute values in `text`.
 * Pure: returns offset-based edits the caller maps to document positions.
 */
export function findConversions(
  text: string,
  options: ConverterOptions,
): BulkConversion[] {
  const conversions: BulkConversion[] = [];

  CLASS_VALUE_RE.lastIndex = 0;
  let attribute: RegExpExecArray | null;
  while ((attribute = CLASS_VALUE_RE.exec(text)) !== null) {
    const content = attribute[2];
    // The closing quote is the final char of the match; content precedes it.
    const contentStart = attribute.index + attribute[0].length - 1 - content.length;

    PX_TOKEN_RE.lastIndex = 0;
    let token: RegExpExecArray | null;
    while ((token = PX_TOKEN_RE.exec(content)) !== null) {
      const result = convertToken(token[0], options);
      if (!result) {
        continue;
      }
      const start = contentStart + token.index;
      conversions.push({
        start,
        end: start + token[0].length,
        original: token[0],
        output: result.output,
      });
    }
  }

  return conversions;
}
