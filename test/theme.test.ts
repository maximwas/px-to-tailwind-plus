import { describe, expect, it } from "vitest";
import {
  extractSpacingFromTheme,
  lengthToPx,
  parseTailwindConfigSource,
  parseThemeCss,
} from "../src/theme/parse";
import { convertToken } from "../src/core";

describe("lengthToPx", () => {
  it("converts px, rem, em and unitless values", () => {
    expect(lengthToPx("16px")).toBe(16);
    expect(lengthToPx("1rem")).toBe(16);
    expect(lengthToPx("1.5rem")).toBe(24);
    expect(lengthToPx("0.5em")).toBe(8);
    expect(lengthToPx("24")).toBe(24);
  });

  it("returns null for unsupported values", () => {
    expect(lengthToPx("100%")).toBeNull();
    expect(lengthToPx("auto")).toBeNull();
    expect(lengthToPx("calc(100% - 4px)")).toBeNull();
  });
});

describe("extractSpacingFromTheme (v3 config object)", () => {
  it("reads theme.spacing and merges theme.extend.spacing", () => {
    const theme = {
      spacing: { sm: "6px", md: "1rem" },
      extend: { spacing: { huge: "200px", md: "20px" } },
    };
    expect(extractSpacingFromTheme(theme)).toEqual({
      sm: 6,
      md: 20, // extend overrides base
      huge: 200,
    });
  });

  it("accepts numeric values and ignores junk", () => {
    const theme = { spacing: { a: 8, b: "auto", c: "2rem" } };
    expect(extractSpacingFromTheme(theme)).toEqual({ a: 8, c: 32 });
  });
});

describe("parseTailwindConfigSource (regex fallback)", () => {
  it("extracts a simple spacing block", () => {
    const source = `module.exports = {
      theme: { extend: { spacing: { sm: '6px', lg: '2rem' } } }
    };`;
    expect(parseTailwindConfigSource(source)).toEqual({ sm: 6, lg: 32 });
  });
});

describe("parseThemeCss (v4 @theme)", () => {
  it("reads --spacing-* tokens and a custom --spacing base", () => {
    const css = `@theme {
      --spacing: 0.25rem;
      --spacing-sm: 6px;
      --spacing-huge: 200px;
    }`;
    const result = parseThemeCss(css);
    expect(result.customSpacing).toEqual({ sm: 6, huge: 200 });
    expect(result.spacingBasePx).toBe(4);
  });

  it("returns empty when there is no @theme block", () => {
    expect(parseThemeCss(".foo { color: red }")).toEqual({ customSpacing: {} });
  });
});

describe("theme integration with the converter", () => {
  it("v3 custom spacing maps px to the theme token", () => {
    const custom = extractSpacingFromTheme({ spacing: { sm: "6px" } });
    const result = convertToken("p-6px", {
      mode: "v3",
      spacingBasePx: 4,
      stepGranularity: 0.25,
      customSpacing: custom,
    });
    expect(result?.output).toBe("p-sm");
  });

  it("v4 respects a custom --spacing base", () => {
    const { customSpacing, spacingBasePx } = parseThemeCss(
      "@theme { --spacing: 8px; }",
    );
    const result = convertToken("p-16px", {
      mode: "v4",
      spacingBasePx: spacingBasePx ?? 4,
      stepGranularity: 0.25,
      customSpacing,
    });
    expect(result?.output).toBe("p-2"); // 16 / 8 = 2
  });
});
