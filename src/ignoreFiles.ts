/**
 * User-configured file exclusion, using the glob syntax people already know from
 * `.gitignore` and VS Code's `files.exclude`. Kept free of any `vscode` import
 * so it can be unit-tested in isolation; the binding lives in settings.ts.
 */
import { Minimatch } from "minimatch";

export interface CompiledIgnorePatterns {
  matchers: Minimatch[];
  /** Patterns that are not valid globs, for reporting. */
  invalid: string[];
}

/**
 * Compiles user-supplied globs. A typo in one pattern must not disable the
 * rest, so invalid ones are collected rather than thrown.
 */
export function compileIgnorePatterns(
  patterns: string[],
): CompiledIgnorePatterns {
  const matchers: Minimatch[] = [];
  const invalid: string[] = [];

  for (const raw of patterns) {
    const pattern = raw?.trim();
    if (!pattern) {
      continue;
    }
    try {
      // A leading `/` reads as "anchored at the workspace root" (.gitignore
      // style); the paths we match are already workspace-relative.
      matchers.push(new Minimatch(stripLeadingSlash(pattern), { dot: true }));
    } catch {
      invalid.push(raw);
    }
  }

  return { matchers, invalid };
}

/**
 * True when `path` — a workspace-relative path — matches any pattern.
 * Separators are normalised to `/` so a single glob works on every OS.
 */
export function isIgnoredPath(
  path: string,
  matchers: readonly Minimatch[],
): boolean {
  if (matchers.length === 0) {
    return false;
  }
  const normalized = stripLeadingSlash(path.replace(/\\/g, "/"));
  return matchers.some((matcher) => matcher.match(normalized));
}

const stripLeadingSlash = (value: string): string => value.replace(/^\/+/, "");
