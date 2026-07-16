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
 * A statement terminator between a quote and the token means that quote closed
 * an earlier string rather than opening the one the token sits in, e.g.
 * `clsx("a"); // p-16px`.
 *
 * Kept to `;` on purpose: `,`, `:`, `{` and `}` occur in Vue's object syntax
 * (`:class="{ 'a': x }"`), and `<`, `>`, `(`, `)` occur in Tailwind arbitrary
 * values and variants (`[&>*]:mt-2`, `w-[calc(100%-1rem)]`). Rejecting on those
 * would drop real classes — far worse than the odd stray highlight.
 */
const NON_CLASS_CONTENT_RE = /;/;

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

  // Walk back to the nearest quote — the candidate opening quote of the class
  // string — and keep walking for nested quotes (`:class="'p-16px'"`).
  //
  // Deliberately never counts quote parity across the window: an apostrophe in
  // ordinary prose (`There's`) reads as an unterminated string to such a count
  // and would silently disable detection for the rest of the file.
  for (let index = prefix.length - 1; index >= 0; index--) {
    const char = prefix[index];
    if (char !== '"' && char !== "'" && char !== "`") {
      continue;
    }

    // Structural characters between the quote and the token mean this quote
    // closed an earlier string rather than opening the class string.
    if (NON_CLASS_CONTENT_RE.test(prefix.slice(index + 1))) {
      return false;
    }

    const beforeQuote = prefix.slice(0, index);
    if (CLASS_ATTRIBUTE_RE.test(beforeQuote)) {
      return true;
    }

    const enclosingCall = findEnclosingCallName(beforeQuote);
    if (enclosingCall !== null && classFunctions.includes(enclosingCall)) {
      return true;
    }
  }

  return false;
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
