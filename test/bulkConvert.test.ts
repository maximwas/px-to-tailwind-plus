import { describe, expect, it } from "vitest";
import { findConversions } from "../src/bulkConvert";
import type { ConverterOptions } from "../src/core";

const v4: ConverterOptions = { mode: "v4", spacingBasePx: 4, stepGranularity: 0.25 };

/** Applies conversions to text (right-to-left) for easy assertions. */
function apply(text: string, options: ConverterOptions): string {
  const edits = findConversions(text, options).sort((a, b) => b.start - a.start);
  let result = text;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.output + result.slice(edit.end);
  }
  return result;
}

describe("findConversions", () => {
  it("converts every px token inside a className", () => {
    const input = '<div className="p-16px mt-8px w-50.5px">';
    expect(apply(input, v4)).toBe('<div className="p-4 mt-2 w-[50.5px]">');
  });

  it("handles HTML class and Vue :class", () => {
    expect(apply('<div class="gap-12px">', v4)).toBe('<div class="gap-3">');
    expect(apply('<div :class="\'p-16px\'">', v4)).toBe('<div :class="\'p-4\'">');
  });

  it("leaves non-class strings untouched", () => {
    const input = 'const label = "p-16px"; <div className="p-16px">';
    expect(apply(input, v4)).toBe(
      'const label = "p-16px"; <div className="p-4">',
    );
  });

  it("reports accurate offsets", () => {
    const input = '<a class="m-8px">';
    const [edit] = findConversions(input, v4);
    expect(input.slice(edit.start, edit.end)).toBe("m-8px");
    expect(edit.output).toBe("m-2");
  });

  it("returns nothing when there is no class attribute", () => {
    expect(findConversions('<div id="p-16px">', v4)).toEqual([]);
  });
});
