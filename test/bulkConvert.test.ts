import { describe, expect, it } from "vitest";
import { findConversions } from "../src/bulkConvert";
import type { ConverterOptions } from "../src/core";

const v4: ConverterOptions = { mode: "v4", spacingBasePx: 4, stepGranularity: 0.25 };

/** Applies conversions to text (right-to-left) for easy assertions. */
function apply(text: string, options: ConverterOptions): string {
  const edits = findConversions(text, options)
    .filter((edit) => edit.kind === "convert")
    .sort((a, b) => b.start - a.start);
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

  it("reduces the arbitrary bracket form inside a class", () => {
    expect(apply('<div className="p-[20px] text-[20px]">', v4)).toBe(
      '<div className="p-5 text-xl">',
    );
  });

  it("is unaffected by apostrophes in prose above the class", () => {
    const input = [
      "// It's a component, don't touch",
      "<Text className=\"mt-18px m-0\">",
      "  Low energy? Brain fog? There's one way to actually know.",
      "</Text>",
    ].join("\n");
    expect(apply(input, v4)).toBe(
      [
        "// It's a component, don't touch",
        "<Text className=\"mt-4.5 m-0\">",
        "  Low energy? Brain fog? There's one way to actually know.",
        "</Text>",
      ].join("\n"),
    );
  });

  it("keeps converting classes that follow apostrophe-bearing JSX text", () => {
    const input = [
      "<Text className=\"mt-7\">There's one way to know.</Text>",
      "<Text className=\"mt-[18px] text-[18px]\">An FDA-approved auto-injector.</Text>",
    ].join("\n");
    expect(apply(input, v4)).toBe(
      [
        "<Text className=\"mt-7\">There's one way to know.</Text>",
        "<Text className=\"mt-4.5 text-lg\">An FDA-approved auto-injector.</Text>",
      ].join("\n"),
    );
  });

  it("converts inside recognised class-utility calls", () => {
    expect(apply('clsx("p-16px")', v4)).toBe('clsx("p-4")');
    expect(apply('cn("p-16px", "m-8px")', v4)).toBe('cn("p-4", "m-2")');
    expect(apply('<div className={clsx("p-[20px]")}>', v4)).toBe(
      '<div className={clsx("p-5")}>',
    );
  });

  it("converts inside a Tailwind @apply rule", () => {
    expect(apply(".card { @apply p-16px mt-8px; }", v4)).toBe(
      ".card { @apply p-4 mt-2; }",
    );
    expect(apply("@apply p-[20px] text-[1.125rem];", v4)).toBe(
      "@apply p-5 text-lg;",
    );
  });

  it("leaves ordinary CSS declarations alone", () => {
    const input = ".card { padding: 16px; margin-top: 8px; }";
    expect(apply(input, v4)).toBe(input);
  });

  it("stops at the end of the @apply rule", () => {
    const input = ".card { @apply flex; }\n.other { border-width: 2px; }";
    expect(apply(input, v4)).toBe(input);
  });

  it("offers a snap next to the exact rewrite, tagged so bulk skips it", () => {
    const options = { ...v4, mode: "v3" as const, snapToNearestPx: 2 };
    const found = findConversions('<div className="p-17px">', options);
    expect(found.map((f) => `${f.kind}:${f.output}`)).toEqual([
      "convert:p-[17px]",
      "snap:p-4",
    ]);
    // Bulk/save apply only the exact rewrite.
    expect(apply('<div className="p-17px">', options)).toBe(
      '<div className="p-[17px]">',
    );
  });

  it("emits no snap unless snapToNearestPx is set", () => {
    const found = findConversions('<div className="p-17px">', {
      ...v4,
      mode: "v3" as const,
    });
    expect(found.every((f) => f.kind === "convert")).toBe(true);
  });

  it("leaves px tokens outside any class context alone", () => {
    const cases = [
      "// p-16px in a line comment",
      "/* block comment p-16px */",
      "* @param token e.g. `p-16px`.",
      'const label = "p-16px";',
      "const t = `p-16px`;",
      "someOtherFn('p-16px')",
      '<div id="p-16px">',
    ];
    for (const input of cases) {
      expect(apply(input, v4)).toBe(input);
    }
  });
});
