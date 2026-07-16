import postcss from "postcss";

/** Custom theme tokens plus an optional `--spacing` base, all in px. */
export interface ThemeSpacing {
  customSpacing: Record<string, number>;
  customFontSize: Record<string, number>;
  customRadius: Record<string, number>;
  spacingBasePx?: number;
}

/** Assumed root font size when converting rem/em to px. */
const ROOT_FONT_SIZE_PX = 16;

/**
 * Converts a CSS length to pixels. Supports px, rem, em and unitless numbers.
 * Returns null for values we can't resolve (%, calc(), auto, …).
 */
export function lengthToPx(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(-?\d*\.?\d+)(px|rem|em)?$/);
  if (!match) {
    return null;
  }
  const amount = parseFloat(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }
  switch (match[2]) {
    case "rem":
    case "em":
      return amount * ROOT_FONT_SIZE_PX;
    case "px":
    case undefined:
      return amount;
    default:
      return null;
  }
}

/**
 * Extracts a px spacing map from a Tailwind config's `theme` object, merging
 * `theme.spacing` with `theme.extend.spacing` (extend wins).
 */
export function extractSpacingFromTheme(
  theme: unknown,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!theme || typeof theme !== "object") {
    return result;
  }

  const themeRecord = theme as Record<string, unknown>;
  addSpacingEntries(themeRecord.spacing, result);

  const extend = themeRecord.extend;
  if (extend && typeof extend === "object") {
    addSpacingEntries((extend as Record<string, unknown>).spacing, result);
  }

  return result;
}

function addSpacingEntries(
  spacing: unknown,
  result: Record<string, number>,
): void {
  if (!spacing || typeof spacing !== "object") {
    return;
  }
  for (const [name, rawValue] of Object.entries(spacing)) {
    if (typeof rawValue === "number") {
      if (Number.isFinite(rawValue) && rawValue >= 0) {
        result[name] = rawValue;
      }
      continue;
    }
    if (typeof rawValue === "string") {
      const px = lengthToPx(rawValue);
      if (px !== null && px >= 0) {
        result[name] = px;
      }
    }
  }
}

/**
 * Regex fallback for extracting `spacing`/`extend.spacing` maps from a Tailwind
 * config source without executing it. Handles simple object literals only;
 * dynamic configs need the child-process reader.
 */
export function parseTailwindConfigSource(source: string): ConfigTokens {
  return {
    spacing: parseConfigBlock(source, "spacing"),
    fontSize: parseConfigBlock(source, "fontSize"),
    radius: parseConfigBlock(source, "borderRadius"),
  };
}

/** Token maps read from a v3 config source, all in px. */
export interface ConfigTokens {
  spacing: Record<string, number>;
  fontSize: Record<string, number>;
  radius: Record<string, number>;
}

/** Pulls `<key>: { name: 'length' }` entries out of config source text. */
function parseConfigBlock(
  source: string,
  key: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  const blockRe = new RegExp(`\\b${key}\\s*:\\s*\\{([\\s\\S]*?)\\}`, "g");
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(source)) !== null) {
    const entryRe = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRe.exec(block[1])) !== null) {
      const px = lengthToPx(entry[2]);
      if (px !== null && px >= 0) {
        result[entry[1]] = px;
      }
    }
  }
  return result;
}

/**
 * Extracts `theme.fontSize` (+ `theme.extend.fontSize`) as px. Tailwind allows
 * either a plain length or a `[size, { lineHeight }]` tuple; only the size is
 * relevant here.
 */
export function extractFontSizeFromTheme(
  theme: unknown,
): Record<string, number> {
  return extractLengthMap(theme, "fontSize");
}

/** Extracts `theme.borderRadius` (+ `theme.extend.borderRadius`) as px. */
export function extractRadiusFromTheme(
  theme: unknown,
): Record<string, number> {
  return extractLengthMap(theme, "borderRadius");
}

function extractLengthMap(
  theme: unknown,
  key: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!theme || typeof theme !== "object") {
    return result;
  }

  const themeRecord = theme as Record<string, unknown>;
  addLengthEntries(themeRecord[key], result);

  const extend = themeRecord.extend;
  if (extend && typeof extend === "object") {
    addLengthEntries((extend as Record<string, unknown>)[key], result);
  }

  return result;
}

function addLengthEntries(
  source: unknown,
  target: Record<string, number>,
): void {
  if (!source || typeof source !== "object") {
    return;
  }
  for (const [name, rawValue] of Object.entries(source)) {
    // `fontSize` entries may be `[size, { lineHeight }]`; the size comes first.
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }
    const px = lengthToPx(String(value));
    if (px !== null && px >= 0) {
      target[name] = px;
    }
  }
}

/**
 * Parses Tailwind v4 `@theme` blocks from CSS, collecting `--spacing-*`,
 * `--text-*` and `--radius-*` tokens plus any custom `--spacing` base. Parsing
 * only — never executes anything.
 */
export function parseThemeCss(css: string): ThemeSpacing {
  const customSpacing: Record<string, number> = {};
  const customFontSize: Record<string, number> = {};
  const customRadius: Record<string, number> = {};
  let spacingBasePx: number | undefined;

  if (!css.includes("@theme")) {
    return { customSpacing, customFontSize, customRadius };
  }

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return { customSpacing, customFontSize, customRadius };
  }

  root.walkAtRules("theme", (atRule) => {
    atRule.walkDecls((decl) => {
      if (decl.prop === "--spacing") {
        const base = lengthToPx(decl.value);
        if (base !== null && base > 0) {
          spacingBasePx = base;
        }
        return;
      }
      collectToken(decl, "--spacing-", customSpacing);
      collectToken(decl, "--text-", customFontSize);
      collectToken(decl, "--radius-", customRadius);
    });
  });

  return spacingBasePx !== undefined
    ? { customSpacing, customFontSize, customRadius, spacingBasePx }
    : { customSpacing, customFontSize, customRadius };
}

/** Records `<prefix><name>: <length>` into `target` when it resolves to px. */
function collectToken(
  decl: postcss.Declaration,
  prefix: string,
  target: Record<string, number>,
): void {
  if (!decl.prop.startsWith(prefix)) {
    return;
  }
  const name = decl.prop.slice(prefix.length);
  const px = lengthToPx(decl.value);
  if (name && px !== null && px >= 0) {
    target[name] = px;
  }
}
