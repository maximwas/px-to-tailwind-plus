import { describe, expect, it } from "vitest";
import { convertToken, describeClass, isMultipleOf } from "../src/core";
import type { ConverterOptions } from "../src/core";

/**
 * Fixture proving that every bare class we emit in v4 mode is a valid
 * Tailwind v4 dynamic-spacing value: it renders as `calc(var(--spacing) * N)`
 * where N is a multiple of 0.25 and `N * --spacing` equals the source px.
 */
describe("v4 dynamic spacing validity", () => {
  const base = 4;
  const opts: ConverterOptions = {
    mode: "v4",
    spacingBasePx: base,
    stepGranularity: 0.25,
  };

  // A representative sweep including quarter, half and integer steps.
  const pxValues = [1, 2, 3, 4, 6, 7, 9, 13, 14, 16, 18, 22, 27, 100, 200, 350];

  for (const px of pxValues) {
    it(`p-${px}px → valid quarter-step class`, () => {
      const result = convertToken(`p-${px}px`, opts);
      expect(result).not.toBeNull();
      expect(result!.isArbitrary).toBe(false);

      // The emitted numeric part, e.g. "3.25" from "p-3.25".
      const n = parseFloat(result!.output.slice("p-".length));
      expect(Number.isFinite(n)).toBe(true);

      // Valid v4 dynamic spacing step.
      expect(isMultipleOf(n, 0.25)).toBe(true);

      // calc(var(--spacing) * N) === original px.
      expect(n * base).toBeCloseTo(px, 9);

      // And it round-trips back to the same px through the hover resolver.
      expect(describeClass(result!.output, opts)!.px).toBeCloseTo(px, 9);
    });
  }

  it("keeps non-quarter values out of the bare form", () => {
    // 2.5px / 4 = 0.625 → not a valid dynamic step.
    const r = convertToken("p-2.5px", opts);
    expect(r!.isArbitrary).toBe(true);
    expect(r!.output).toBe("p-[2.5px]");
  });
});
