import { describe, expect, it } from "vitest";
import { findSnapSuggestion } from "../src/core";
import type { ConverterOptions } from "../src/core";

const v4 = (over: Partial<ConverterOptions> = {}): ConverterOptions => ({
  mode: "v4",
  spacingBasePx: 4,
  stepGranularity: 0.25,
  ...over,
});
const v3 = (over: Partial<ConverterOptions> = {}): ConverterOptions => ({
  mode: "v3",
  spacingBasePx: 4,
  stepGranularity: 0.25,
  ...over,
});

const snap = (token: string, opts: ConverterOptions): string | null =>
  findSnapSuggestion(token, opts)?.output ?? null;

describe("findSnapSuggestion — off by default", () => {
  it("suggests nothing unless snapToNearestPx is set", () => {
    expect(findSnapSuggestion("p-17px", v3())).toBeNull();
    expect(findSnapSuggestion("p-17px", v3({ snapToNearestPx: 0 }))).toBeNull();
  });
});

describe("findSnapSuggestion — v3 fixed scale", () => {
  it("snaps an off-scale value to the nearest scale token", () => {
    expect(snap("p-17px", v3({ snapToNearestPx: 2 }))).toBe("p-4");
    expect(snap("p-23px", v3({ snapToNearestPx: 2 }))).toBe("p-6");
  });

  it("respects the distance budget", () => {
    expect(snap("p-17px", v3({ snapToNearestPx: 0.5 }))).toBeNull();
    expect(snap("w-137px", v3({ snapToNearestPx: 2 }))).toBeNull();
  });

  it("suggests nothing when the value is already on the scale", () => {
    expect(findSnapSuggestion("p-16px", v3({ snapToNearestPx: 2 }))).toBeNull();
  });

  it("reports what it snapped from and to", () => {
    const result = findSnapSuggestion("p-17px", v3({ snapToNearestPx: 2 }));
    expect(result).toEqual({ output: "p-4", px: 16, fromPx: 17 });
  });
});

describe("findSnapSuggestion — the bracket form is where it matters most", () => {
  it("snaps a pasted arbitrary value", () => {
    expect(snap("p-[17px]", v3({ snapToNearestPx: 2 }))).toBe("p-4");
    expect(snap("text-[21px]", v4({ snapToNearestPx: 2 }))).toBe("text-xl");
  });

  it("snaps rem input too", () => {
    expect(snap("p-[1.05rem]", v3({ snapToNearestPx: 2 }))).toBe("p-4");
  });
});

describe("findSnapSuggestion — named scales", () => {
  it("snaps font sizes", () => {
    expect(snap("text-21px", v4({ snapToNearestPx: 2 }))).toBe("text-xl");
    expect(snap("text-40px", v4({ snapToNearestPx: 2 }))).toBeNull(); // 36/48 too far
  });

  it("snaps radii", () => {
    expect(snap("rounded-9px", v4({ snapToNearestPx: 2 }))).toBe("rounded-lg");
    expect(snap("rounded-9px", v3({ snapToNearestPx: 2 }))).toBe("rounded-lg");
  });

  it("snaps direct widths on the v3 set", () => {
    expect(snap("border-3px", v3({ snapToNearestPx: 1 }))).toBe("border-2");
  });
});

describe("findSnapSuggestion — v4 dynamic spacing", () => {
  it("suggests nothing when quarter steps already cover the value", () => {
    expect(findSnapSuggestion("p-17px", v4({ snapToNearestPx: 2 }))).toBeNull();
  });

  it("snaps when the granularity leaves the value off-scale", () => {
    const options = v4({ stepGranularity: 1, snapToNearestPx: 2 });
    expect(snap("p-17px", options)).toBe("p-4");
  });
});

describe("findSnapSuggestion — respects intent", () => {
  it("never overrides arbitraryFor", () => {
    expect(
      findSnapSuggestion(
        "text-21px",
        v4({ snapToNearestPx: 2, arbitraryFor: ["fontSize"] }),
      ),
    ).toBeNull();
  });

  it("never snaps tracking, which is always arbitrary", () => {
    expect(
      findSnapSuggestion("tracking-1.5px", v4({ snapToNearestPx: 2 })),
    ).toBeNull();
  });

  it("keeps negatives, important and variants", () => {
    expect(snap("-mt-17px", v3({ snapToNearestPx: 2 }))).toBe("-mt-4");
    expect(snap("md:!p-17px", v3({ snapToNearestPx: 2 }))).toBe("md:!p-4");
  });

  it("counts custom theme tokens as snap targets", () => {
    const options = v3({ snapToNearestPx: 2, customSpacing: { gutter: 20 } });
    expect(snap("p-19px", options)).toBe("p-gutter");
  });
});
