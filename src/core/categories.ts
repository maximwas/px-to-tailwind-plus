import type { ValueKind } from "./types";

export interface PropertyDef {
  category: ValueKind;
  /** Human-readable CSS property (used by hover tooltips). */
  cssProperty: string;
  /** In v3 this property has no fixed scale, so it always goes arbitrary. */
  v4Only?: boolean;
  /** Negative values are meaningful for this property. */
  allowNegative?: boolean;
  /** In the border/divide families, a value of 1 collapses to the bare class. */
  bareAtOne?: boolean;
}

/** Helper to declare many properties that share the same definition. */
function group(
  props: Array<[prop: string, cssProperty: string]>,
  base: Omit<PropertyDef, "cssProperty">,
): Array<[string, PropertyDef]> {
  return props.map(([prop, cssProperty]) => [prop, { ...base, cssProperty }]);
}

/**
 * Single source of truth mapping a utility prefix to how it converts.
 * Adding a new supported property is a one-line change here.
 */
export const PROPERTY_TABLE: ReadonlyMap<string, PropertyDef> = new Map<
  string,
  PropertyDef
>([
  // ---- Spacing scale ------------------------------------------------------
  ...group(
    [
      ["p", "padding"],
      ["px", "padding-inline"],
      ["py", "padding-block"],
      ["pt", "padding-top"],
      ["pr", "padding-right"],
      ["pb", "padding-bottom"],
      ["pl", "padding-left"],
      ["m", "margin"],
      ["mx", "margin-inline"],
      ["my", "margin-block"],
      ["mt", "margin-top"],
      ["mr", "margin-right"],
      ["mb", "margin-bottom"],
      ["ml", "margin-left"],
      ["gap", "gap"],
      ["gap-x", "column-gap"],
      ["gap-y", "row-gap"],
      ["w", "width"],
      ["h", "height"],
      ["size", "width & height"],
      ["top", "top"],
      ["right", "right"],
      ["bottom", "bottom"],
      ["left", "left"],
      ["inset", "inset"],
      ["inset-x", "inset-inline"],
      ["inset-y", "inset-block"],
      ["translate-x", "translate (x)"],
      ["translate-y", "translate (y)"],
      ["space-x", "column gap (space-x)"],
      ["space-y", "row gap (space-y)"],
      ["scroll-m", "scroll-margin"],
      ["scroll-mx", "scroll-margin-inline"],
      ["scroll-my", "scroll-margin-block"],
      ["scroll-mt", "scroll-margin-top"],
      ["scroll-mr", "scroll-margin-right"],
      ["scroll-mb", "scroll-margin-bottom"],
      ["scroll-ml", "scroll-margin-left"],
      ["scroll-p", "scroll-padding"],
      ["scroll-px", "scroll-padding-inline"],
      ["scroll-py", "scroll-padding-block"],
      ["scroll-pt", "scroll-padding-top"],
      ["scroll-pr", "scroll-padding-right"],
      ["scroll-pb", "scroll-padding-bottom"],
      ["scroll-pl", "scroll-padding-left"],
      ["basis", "flex-basis"],
      ["indent", "text-indent"],
    ],
    { category: "spacing", allowNegative: true },
  ),
  // Spacing properties that only have a dynamic scale in v4.
  ...group(
    [
      ["min-w", "min-width"],
      ["max-w", "max-width"],
      ["min-h", "min-height"],
      ["max-h", "max-height"],
      ["leading", "line-height"],
    ],
    { category: "spacing", allowNegative: true, v4Only: true },
  ),

  // ---- Direct px scale ----------------------------------------------------
  ...group(
    [
      ["border", "border-width"],
      ["border-x", "border-inline-width"],
      ["border-y", "border-block-width"],
      ["border-t", "border-top-width"],
      ["border-r", "border-right-width"],
      ["border-b", "border-bottom-width"],
      ["border-l", "border-left-width"],
      ["divide-x", "column border width"],
      ["divide-y", "row border width"],
    ],
    { category: "direct", bareAtOne: true },
  ),
  ...group(
    [
      ["ring", "ring width (box-shadow)"],
      ["outline", "outline-width"],
      ["outline-offset", "outline-offset"],
      ["stroke", "stroke-width"],
    ],
    { category: "direct" },
  ),

  // ---- Font size ----------------------------------------------------------
  ["text", { category: "fontSize", cssProperty: "font-size" }],

  // ---- Border radius ------------------------------------------------------
  ...group(
    [
      ["rounded", "border-radius"],
      ["rounded-s", "border-start-radius"],
      ["rounded-e", "border-end-radius"],
      ["rounded-t", "border-top-radius"],
      ["rounded-r", "border-right-radius"],
      ["rounded-b", "border-bottom-radius"],
      ["rounded-l", "border-left-radius"],
      ["rounded-ss", "border-start-start-radius"],
      ["rounded-se", "border-start-end-radius"],
      ["rounded-ee", "border-end-end-radius"],
      ["rounded-es", "border-end-start-radius"],
      ["rounded-tl", "border-top-left-radius"],
      ["rounded-tr", "border-top-right-radius"],
      ["rounded-br", "border-bottom-right-radius"],
      ["rounded-bl", "border-bottom-left-radius"],
    ],
    { category: "radius" },
  ),

  // ---- Tracking (letter-spacing) -----------------------------------------
  ["tracking", { category: "tracking", cssProperty: "letter-spacing", allowNegative: true }],
]);

export function getPropertyDef(property: string): PropertyDef | undefined {
  return PROPERTY_TABLE.get(property);
}
