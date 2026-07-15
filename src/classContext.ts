/**
 * Lightweight, dependency-free detection of class-attribute context. Kept free
 * of any `vscode` import so it can be unit-tested in isolation; the VS Code
 * binding lives in changeHandler.ts.
 */

/** How many lines to look back when resolving a multi-line class string. */
export const LOOKBACK_LINES = 30;
export const MAX_WINDOW_CHARS = 5000;

/** Class utility functions treated as class context out of the box. */
export const DEFAULT_CLASS_FUNCTIONS = [
  "clsx",
  "cn",
  "cx",
  "cva",
  "classnames",
  "classNames",
  "tw",
  "twMerge",
  "twJoin",
];

/**
 * Matches a class-like attribute assignment immediately preceding the opening
 * quote of a string, e.g. `class=`, `className={`, `:class="`, `className={clsx(`.
 */
const CLASS_ATTRIBUTE_RE =
  /(?:^|[\s{(,>])(?:class(?:name)?|:class|v-bind:class)\s*=\s*\{?\s*(?:[\w$.]+\s*\(\s*)*$/i;

const IDENTIFIER_TAIL_RE = /([\w$]+)$/;

/**
 * Non-parsing check for whether a token sits inside a class attribute value.
 * Operates purely on the text before the token.
 *
 * @param prefix         Text from a lookback window up to (excluding) the token.
 * @param token          The token being completed, e.g. `p-16px`.
 * @param classFunctions Utility function names whose string arguments count as
 *                       class context (e.g. `clsx`, `cn`).
 */
export function isClassAttributeContext(
  prefix: string,
  token: string,
  classFunctions: string[] = DEFAULT_CLASS_FUNCTIONS,
): boolean {
  // Svelte class directive: the utility lives in the attribute name itself.
  if (token.startsWith("class:")) {
    return true;
  }

  const openingQuoteIndex = findEnclosingStringStart(prefix);
  if (openingQuoteIndex === -1) {
    return false;
  }

  const beforeQuote = prefix.slice(0, openingQuoteIndex);
  if (CLASS_ATTRIBUTE_RE.test(beforeQuote)) {
    return true;
  }

  const enclosingCall = findEnclosingCallName(beforeQuote);
  return enclosingCall !== null && classFunctions.includes(enclosingCall);
}

/**
 * Returns the index of the quote that opens the string the caret is inside, or
 * -1 when the caret is not inside a string. Handles `"`, `'` and backticks.
 */
function findEnclosingStringStart(prefix: string): number {
  let quoteChar: string | null = null;
  let quoteStart = -1;

  for (let index = 0; index < prefix.length; index++) {
    const char = prefix[index];
    if (quoteChar) {
      if (char === quoteChar) {
        quoteChar = null;
        quoteStart = -1;
      }
    } else if (char === '"' || char === "'" || char === "`") {
      quoteChar = char;
      quoteStart = index;
    }
  }

  return quoteChar ? quoteStart : -1;
}

/**
 * Finds the identifier of the innermost function call the caret sits inside, by
 * scanning backwards for the nearest unbalanced `(`. Returns null when the caret
 * is not inside a call.
 */
function findEnclosingCallName(text: string): string | null {
  let depth = 0;
  for (let index = text.length - 1; index >= 0; index--) {
    const char = text[index];
    if (char === ")") {
      depth++;
    } else if (char === "(") {
      if (depth === 0) {
        const identifierMatch = text.slice(0, index).match(IDENTIFIER_TAIL_RE);
        return identifierMatch ? identifierMatch[1] : null;
      }
      depth--;
    }
  }
  return null;
}
