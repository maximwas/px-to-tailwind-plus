import { describe, expect, it } from "vitest";
import { describeClass } from "../src/core";
import type { ConverterOptions } from "../src/core";

const v4: ConverterOptions = { mode: "v4", spacingBasePx: 4, stepGranularity: 0.25 };
const v3: ConverterOptions = { mode: "v3", spacingBasePx: 4, stepGranularity: 0.25 };

describe("describeClass (hover reverse lookup)", () => {
  it("resolves integer spacing classes in v4", () => {
    expect(describeClass("p-4", v4)).toMatchObject({
      cssProperty: "padding",
      px: 16,
      rem: 1,
      isArbitrary: false,
    });
  });

  it("resolves fractional spacing classes in v4", () => {
    expect(describeClass("px-3.25", v4)).toMatchObject({
      cssProperty: "padding-inline",
      px: 13,
      rem: 0.8125,
    });
  });

  it("resolves arbitrary values", () => {
    expect(describeClass("w-[50.5px]", v4)).toMatchObject({
      cssProperty: "width",
      px: 50.5,
      isArbitrary: true,
    });
  });

  it("handles negatives", () => {
    expect(describeClass("-mt-2", v4)).toMatchObject({ px: -8 });
    expect(describeClass("mt-[-3px]", v4)).toMatchObject({ px: -3 });
  });

  it("resolves v3 classic scale via the fixed map", () => {
    expect(describeClass("p-4", v3)).toMatchObject({ px: 16 });
    expect(describeClass("p-3.5", v3)).toMatchObject({ px: 14 });
  });

  it("resolves custom theme tokens", () => {
    expect(
      describeClass("p-sm", { ...v4, customSpacing: { sm: 6 } }),
    ).toMatchObject({ px: 6, rem: 0.375 });
  });

  it("respects spacingBasePx", () => {
    expect(describeClass("p-2", { ...v4, spacingBasePx: 8 })).toMatchObject({
      px: 16,
    });
  });

  it("ignores non-spacing classes", () => {
    expect(describeClass("text-sm", v4)).toBeNull();
    expect(describeClass("rounded-lg", v4)).toBeNull();
    expect(describeClass("flex", v4)).toBeNull();
  });
});
