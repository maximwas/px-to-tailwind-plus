import {
  convertToken,
  findSnapSuggestion,
  type ConverterOptions,
} from "./core";
import { DEFAULT_CLASS_FUNCTIONS } from "./classContext";

export interface BulkConversion {
  /** Absolute start offset of the token within the source text. */
  start: number;
  /** Absolute end offset (exclusive). */
  end: number;
  original: string;
  output: string;
  /**
   * `convert` is an exact rewrite and is safe to apply in bulk. `snap` moves the
   * value by up to `snapToNearestPx`, so it is only ever offered as a quick fix.
   */
  kind: "convert" | "snap";
}

/**
 * Matches a candidate px token (with optional variant chain / negative sign)
 * anywhere in the text. The value is either the bare-suffix form (`16px`) or
 * the Tailwind arbitrary form (`[16px]`). convertToken and
 * isClassAttributeContext remain the source of truth for whether a match is a
 * real, convertible class utility.
 */
const PX_TOKEN_RE =
  /(?:[\w-]+:)*!?-?[a-z][\w-]*-(?:\d*\.?\d+(?:px|rem)|\[\d*\.?\d+(?:px|rem)\])/gi;

/** Matches class attribute values and captures the quote + inner content. */
const CLASS_VALUE_RE =
  /(?:class(?:Name)?|:class|v-bind:class)\s*=\s*(["'`])([\s\S]*?)\1/g;

/** Matches a quoted string and captures the quote + inner content. */
const STRING_RE = /(["'`])([\s\S]*?)\1/g;

/**
 * Tailwind's `@apply` in CSS/SCSS, capturing the bare utility list. The rule
 * ends at `;` or a brace, so the value never runs past it.
 */
const APPLY_RE = /@apply\b([^;{}]*)/g;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds every convertible px token inside class attribute values and recognised
 * class-utility calls (`clsx("…")`, `cn("…")`, including `className={clsx("…")}`).
 *
 * Detection is anchored on the `class`/`className`/`:class` keyword or the call
 * name and only scans that value. It deliberately never counts quotes across the
 * document: an apostrophe in ordinary prose (`There's`) would skew such a count
 * and silently disable conversion for the rest of the file.
 *
 * Known limitation: class-like markup written inside a plain string literal
 * (e.g. `const s = '<div className="p-16px">'` in test fixtures) still matches.
 * Telling that apart from real JSX needs a full parser; being wrong there is far
 * cheaper than missing real classes.
 *
 * Pure: returns offset-based edits the caller maps to document positions.
 */
export function findConversions(
  text: string,
  options: ConverterOptions,
  classFunctions: string[] = DEFAULT_CLASS_FUNCTIONS,
): BulkConversion[] {
  const conversions: BulkConversion[] = [];
  const seen = new Set<string>();

  const push = (
    start: number,
    original: string,
    output: string,
    kind: BulkConversion["kind"],
  ): void => {
    const key = `${start}:${kind}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    conversions.push({ start, end: start + original.length, original, output, kind });
  };

  const collect = (content: string, contentStart: number): void => {
    PX_TOKEN_RE.lastIndex = 0;
    let token: RegExpExecArray | null;
    while ((token = PX_TOKEN_RE.exec(content)) !== null) {
      const original = token[0];
      const start = contentStart + token.index;

      const result = convertToken(original, options);
      if (result) {
        push(start, original, result.output, "convert");
      }

      const snap = findSnapSuggestion(original, options);
      if (snap) {
        push(start, original, snap.output, "snap");
      }
    }
  };

  CLASS_VALUE_RE.lastIndex = 0;
  let attribute: RegExpExecArray | null;
  while ((attribute = CLASS_VALUE_RE.exec(text)) !== null) {
    const content = attribute[2];
    // The closing quote is the final char of the match; content precedes it.
    collect(content, attribute.index + attribute[0].length - 1 - content.length);
  }

  APPLY_RE.lastIndex = 0;
  let applyRule: RegExpExecArray | null;
  while ((applyRule = APPLY_RE.exec(text)) !== null) {
    const utilities = applyRule[1];
    collect(utilities, applyRule.index + applyRule[0].length - utilities.length);
  }

  if (classFunctions.length > 0) {
    const callRe = new RegExp(
      `\\b(?:${classFunctions.map(escapeRegExp).join("|")})\\s*\\(([\\s\\S]*?)\\)`,
      "g",
    );
    let call: RegExpExecArray | null;
    while ((call = callRe.exec(text)) !== null) {
      const args = call[1];
      const argsStart = call.index + call[0].length - 1 - args.length;

      STRING_RE.lastIndex = 0;
      let literal: RegExpExecArray | null;
      while ((literal = STRING_RE.exec(args)) !== null) {
        // +1 skips the opening quote captured by the string match.
        collect(literal[2], argsStart + literal.index + 1);
      }
    }
  }

  conversions.sort((a, b) => a.start - b.start);
  return conversions;
}
