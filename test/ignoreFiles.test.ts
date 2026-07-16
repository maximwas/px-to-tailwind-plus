import { describe, expect, it } from "vitest";
import { compileIgnorePatterns, isIgnoredPath } from "../src/ignoreFiles";

const ignored = (path: string, patterns: string[]): boolean =>
  isIgnoredPath(path, compileIgnorePatterns(patterns).matchers);

describe("compileIgnorePatterns", () => {
  it("compiles valid globs and reports none invalid", () => {
    const result = compileIgnorePatterns(["**/*.test.ts", "/dist/**"]);
    expect(result.matchers).toHaveLength(2);
    expect(result.invalid).toEqual([]);
  });

  it("skips empty entries", () => {
    expect(compileIgnorePatterns(["", "   "]).matchers).toHaveLength(0);
  });

  it("returns nothing for an empty list", () => {
    expect(compileIgnorePatterns([])).toEqual({ matchers: [], invalid: [] });
  });
});

describe("isIgnoredPath", () => {
  it("ignores nothing when no patterns are configured", () => {
    expect(ignored("src/foo.test.ts", [])).toBe(false);
  });

  it("matches test files with the usual glob", () => {
    expect(ignored("src/foo.test.ts", ["**/*.test.ts"])).toBe(true);
    expect(ignored("src/foo.ts", ["**/*.test.ts"])).toBe(false);
  });

  it("matches a test file at the root too", () => {
    expect(ignored("foo.test.ts", ["**/*.test.ts"])).toBe(true);
  });

  it("matches whole folders", () => {
    expect(ignored("src/a/b.ts", ["src/**"])).toBe(true);
    expect(ignored("app/dist/bundle.js", ["**/dist/**"])).toBe(true);
    expect(ignored("src/__tests__/a.tsx", ["**/__tests__/**"])).toBe(true);
    expect(ignored("lib/a.ts", ["src/**"])).toBe(false);
  });

  it("treats a leading slash as anchored at the workspace root", () => {
    expect(ignored("src/a/b.ts", ["/src/**"])).toBe(true);
    expect(ignored("lib/src/b.ts", ["/src/**"])).toBe(false);
  });

  it("supports brace expansion", () => {
    expect(ignored("src/a.spec.tsx", ["**/*.{test,spec}.tsx"])).toBe(true);
    expect(ignored("src/a.test.tsx", ["**/*.{test,spec}.tsx"])).toBe(true);
    expect(ignored("src/a.tsx", ["**/*.{test,spec}.tsx"])).toBe(false);
  });

  it("matches when any one of several patterns hits", () => {
    const patterns = ["**/*.test.ts", "**/dist/**"];
    expect(ignored("src/a.test.ts", patterns)).toBe(true);
    expect(ignored("app/dist/b.js", patterns)).toBe(true);
    expect(ignored("src/app.tsx", patterns)).toBe(false);
  });

  it("matches dot-folders", () => {
    expect(ignored(".storybook/preview.ts", ["**/.storybook/**"])).toBe(true);
  });

  it("normalises Windows separators so one pattern works everywhere", () => {
    expect(ignored("src\\__tests__\\a.tsx", ["**/__tests__/**"])).toBe(true);
  });
});
