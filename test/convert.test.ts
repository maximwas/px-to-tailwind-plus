import { describe, expect, it } from "vitest";
import { convertToken } from "../src/core";
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

const out = (token: string, opts: ConverterOptions): string | null =>
  convertToken(token, opts)?.output ?? null;

describe("v4 spacing — quarter-step dynamic scale", () => {
  it("maps integer scale values", () => {
    expect(out("p-16px", v4())).toBe("p-4");
    expect(out("w-350px", v4())).toBe("w-87.5"); // 350/4 = 87.5 (half step)
    expect(out("w-200px", v4())).toBe("w-50");
  });

  it("maps quarter and half steps to bare classes", () => {
    expect(out("px-13px", v4())).toBe("px-3.25");
    expect(out("p-18px", v4())).toBe("p-4.5");
  });

  it("emits Tailwind's dedicated 1px utility", () => {
    expect(out("w-1px", v4())).toBe("w-px");
    expect(out("p-1px", v4())).toBe("p-px");
    expect(out("-mt-1px", v4())).toBe("-mt-px");
    expect(out("size-1px", v4())).toBe("size-px");
    expect(out("p-1px", v3())).toBe("p-px");
  });

  it("supports negatives", () => {
    expect(out("-mt-8px", v4())).toBe("-mt-2");
    expect(out("-mt-13px", v4())).toBe("-mt-3.25");
  });

  it("falls back to arbitrary for non-quarter steps", () => {
    expect(out("w-50.5px", v4())).toBe("w-[50.5px]"); // 12.625
    expect(out("p-2.5px", v4())).toBe("p-[2.5px]"); // 0.625
  });

  it("covers the extended spacing property set", () => {
    expect(out("gap-x-12px", v4())).toBe("gap-x-3");
    expect(out("size-16px", v4())).toBe("size-4");
    expect(out("scroll-mt-16px", v4())).toBe("scroll-mt-4");
    expect(out("scroll-pb-8px", v4())).toBe("scroll-pb-2");
    expect(out("translate-x-8px", v4())).toBe("translate-x-2");
    expect(out("space-y-4px", v4())).toBe("space-y-1");
    expect(out("basis-16px", v4())).toBe("basis-4");
    expect(out("indent-8px", v4())).toBe("indent-2");
    expect(out("inset-x-16px", v4())).toBe("inset-x-4");
  });

  it("handles v4-only spacing properties dynamically", () => {
    expect(out("min-w-100px", v4())).toBe("min-w-25");
    expect(out("max-h-40px", v4())).toBe("max-h-10");
    expect(out("leading-24px", v4())).toBe("leading-6");
  });
});

describe("v4 spacingBasePx override", () => {
  it("divides by the configured base", () => {
    const options = v4({ spacingBasePx: 8 });
    expect(out("p-16px", options)).toBe("p-2");
    expect(out("p-4px", options)).toBe("p-0.5");
    expect(out("p-2px", options)).toBe("p-0.25");
    expect(out("p-1px", options)).toBe("p-px"); // dedicated 1px utility, base-independent
    expect(out("p-3px", options)).toBe("p-[3px]"); // 0.375 not a quarter step
  });
});

describe("stepGranularity", () => {
  it("0.5 restricts quarter steps to arbitrary", () => {
    const options = v4({ stepGranularity: 0.5 });
    expect(out("p-18px", options)).toBe("p-4.5");
    expect(out("px-13px", options)).toBe("px-[13px]"); // 3.25 not a half step
  });

  it("1 restricts to integers only", () => {
    const options = v4({ stepGranularity: 1 });
    expect(out("p-16px", options)).toBe("p-4");
    expect(out("p-18px", options)).toBe("p-[18px]"); // 4.5 not an integer
    expect(out("p-2px", options)).toBe("p-[2px]"); // 0.5 not an integer
    expect(out("p-1px", options)).toBe("p-px"); // dedicated utility, unaffected by granularity
  });
});

describe("v3 fixed classic scale", () => {
  it("maps values on the classic scale", () => {
    expect(out("p-16px", v3())).toBe("p-4");
    expect(out("p-24px", v3())).toBe("p-6");
    expect(out("p-2px", v3())).toBe("p-0.5");
    expect(out("p-10px", v3())).toBe("p-2.5");
    expect(out("-mt-8px", v3())).toBe("-mt-2");
  });

  it("sends off-scale values to arbitrary", () => {
    expect(out("p-13px", v3())).toBe("p-[13px]");
    expect(out("w-200px", v3())).toBe("w-[200px]");
  });

  it("treats v4-only spacing props as arbitrary", () => {
    expect(out("min-w-16px", v3())).toBe("min-w-[16px]");
    expect(out("leading-24px", v3())).toBe("leading-[24px]");
  });
});

describe("direct px scale (borders, ring, outline, stroke)", () => {
  it("v4 allows any integer, 1 collapses to bare for border/divide", () => {
    expect(out("border-2px", v4())).toBe("border-2");
    expect(out("border-1px", v4())).toBe("border");
    expect(out("border-3px", v4())).toBe("border-3");
    expect(out("border-t-2px", v4())).toBe("border-t-2");
    expect(out("divide-x-1px", v4())).toBe("divide-x");
    expect(out("ring-1px", v4())).toBe("ring-1");
    expect(out("outline-2px", v4())).toBe("outline-2");
    expect(out("outline-offset-4px", v4())).toBe("outline-offset-4");
    expect(out("stroke-2px", v4())).toBe("stroke-2");
    expect(out("border-2.5px", v4())).toBe("border-[2.5px]");
  });

  it("v3 restricts to {0,1,2,4,8}", () => {
    expect(out("border-2px", v3())).toBe("border-2");
    expect(out("border-4px", v3())).toBe("border-4");
    expect(out("border-8px", v3())).toBe("border-8");
    expect(out("border-1px", v3())).toBe("border");
    expect(out("border-3px", v3())).toBe("border-[3px]");
    expect(out("ring-3px", v3())).toBe("ring-[3px]");
  });
});

describe("font size", () => {
  it("maps named sizes, else arbitrary", () => {
    expect(out("text-14px", v4())).toBe("text-sm");
    expect(out("text-16px", v4())).toBe("text-base");
    expect(out("text-128px", v3())).toBe("text-9xl");
    expect(out("text-15px", v4())).toBe("text-[15px]");
  });
});

describe("border radius", () => {
  it("v4 named scale", () => {
    expect(out("rounded-8px", v4())).toBe("rounded-lg");
    expect(out("rounded-4px", v4())).toBe("rounded-sm");
    expect(out("rounded-2px", v4())).toBe("rounded-xs");
    expect(out("rounded-t-16px", v4())).toBe("rounded-t-2xl");
    expect(out("rounded-32px", v4())).toBe("rounded-4xl");
    expect(out("rounded-5px", v4())).toBe("rounded-[5px]");
  });

  it("v3 named scale with bare rounded at 4px", () => {
    expect(out("rounded-4px", v3())).toBe("rounded");
    expect(out("rounded-2px", v3())).toBe("rounded-sm");
    expect(out("rounded-8px", v3())).toBe("rounded-lg");
    expect(out("rounded-tl-4px", v3())).toBe("rounded-tl");
    expect(out("rounded-32px", v3())).toBe("rounded-[32px]");
  });
});

describe("tracking (always arbitrary px)", () => {
  it("emits arbitrary values, positive and negative", () => {
    expect(out("tracking-1px", v4())).toBe("tracking-[1px]");
    expect(out("-tracking-1px", v4())).toBe("-tracking-[1px]");
    expect(out("tracking-2px", v3())).toBe("tracking-[2px]");
  });
});

describe("custom theme spacing", () => {
  it("v3 maps exact px matches to the custom key", () => {
    const options = v3({ customSpacing: { sm: 6 } });
    expect(out("p-6px", options)).toBe("p-sm");
    expect(out("w-6px", options)).toBe("w-sm");
    expect(out("p-8px", options)).toBe("p-2"); // no custom match, default scale
  });

  it("v4 custom tokens win over the dynamic scale", () => {
    const options = v4({ customSpacing: { huge: 200 } });
    expect(out("w-200px", options)).toBe("w-huge");
    expect(out("p-16px", options)).toBe("p-4"); // unaffected
  });

  it("v3 does not apply custom spacing to v4-only props", () => {
    const options = v3({ customSpacing: { sm: 6 } });
    expect(out("min-w-6px", options)).toBe("min-w-[6px]");
  });
});

describe("arbitraryFor setting forces arbitrary values", () => {
  it("keeps font sizes and radii as arbitrary when requested", () => {
    expect(out("text-14px", v4({ arbitraryFor: ["fontSize"] }))).toBe(
      "text-[14px]",
    );
    expect(out("rounded-8px", v4({ arbitraryFor: ["radius"] }))).toBe(
      "rounded-[8px]",
    );
    expect(out("border-2px", v4({ arbitraryFor: ["direct"] }))).toBe(
      "border-[2px]",
    );
    expect(out("p-16px", v4({ arbitraryFor: ["spacing"] }))).toBe("p-[16px]");
  });

  it("leaves other categories untouched", () => {
    const options = v4({ arbitraryFor: ["fontSize"] });
    expect(out("p-16px", options)).toBe("p-4");
    expect(out("rounded-8px", options)).toBe("rounded-lg");
  });
});

describe("negatives only where applicable", () => {
  it("rejects negatives for non-spacing categories", () => {
    expect(convertToken("-border-2px", v4())).toBeNull();
    expect(convertToken("-text-14px", v4())).toBeNull();
    expect(convertToken("-rounded-8px", v4())).toBeNull();
  });
});

describe("variants and important markers are preserved", () => {
  it("keeps variant chains and negatives", () => {
    expect(out("md:p-16px", v4())).toBe("md:p-4");
    expect(out("md:hover:-mt-8px", v4())).toBe("md:hover:-mt-2");
    expect(out("md:w-50.5px", v4())).toBe("md:w-[50.5px]");
    expect(out("!p-16px", v4())).toBe("!p-4");
  });
});

describe("arbitrary bracket px form is reduced to the scale token", () => {
  it("reduces bracket spacing on the v4 dynamic scale", () => {
    expect(out("p-[20px]", v4())).toBe("p-5");
    expect(out("p-[7px]", v4())).toBe("p-1.75");
  });

  it("reduces bracket spacing on the v3 classic scale", () => {
    expect(out("p-[20px]", v3())).toBe("p-5");
  });

  it("reduces bracket font size", () => {
    expect(out("text-[20px]", v4())).toBe("text-xl");
  });

  it("leaves irreducible bracket values untouched (no-op)", () => {
    expect(convertToken("p-[7.3px]", v4())).toBeNull();
  });

  it("honours custom spacing tokens", () => {
    expect(out("p-[20px]", v4({ customSpacing: { huge: 20 } }))).toBe("p-huge");
  });

  it("respects arbitraryFor by leaving the value arbitrary (no-op)", () => {
    expect(convertToken("p-[16px]", v4({ arbitraryFor: ["spacing"] }))).toBeNull();
  });

  it("preserves negatives, important and variant chains", () => {
    expect(out("md:-mt-[20px]", v4())).toBe("md:-mt-5");
    expect(out("!p-[20px]", v4())).toBe("!p-5");
  });

  it("ignores bracket values in units other than px", () => {
    expect(convertToken("p-[1.25rem]", v4())).toBeNull();
    expect(convertToken("w-[50%]", v4())).toBeNull();
  });
});

describe("non-tokens are ignored", () => {
  it("returns null for unsupported or malformed input", () => {
    expect(convertToken("p-16", v4())).toBeNull();
    expect(convertToken("foo-16px", v4())).toBeNull();
    expect(convertToken("16px", v4())).toBeNull();
    expect(convertToken("", v4())).toBeNull();
    expect(convertToken("flex", v4())).toBeNull();
  });
});
