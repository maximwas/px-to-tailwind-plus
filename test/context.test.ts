import { describe, expect, it } from "vitest";
import { isClassAttributeContext } from "../src/classContext";

const TOKEN = "p-16px";

describe("isClassAttributeContext — inside class strings", () => {
  it("HTML class attribute", () => {
    expect(isClassAttributeContext('<div class="', TOKEN)).toBe(true);
    expect(isClassAttributeContext("<div class='flex ", TOKEN)).toBe(true);
  });

  it("JSX className with string and expression", () => {
    expect(isClassAttributeContext('<div className="', TOKEN)).toBe(true);
    expect(isClassAttributeContext("<div className={'", TOKEN)).toBe(true);
    expect(isClassAttributeContext("<div className={`", TOKEN)).toBe(true);
    expect(isClassAttributeContext('<div className={clsx("', TOKEN)).toBe(true);
    expect(isClassAttributeContext('<div className={cn(clsx("', TOKEN)).toBe(true);
  });

  it("Vue :class and v-bind:class, including nested strings", () => {
    expect(isClassAttributeContext('<div :class="', TOKEN)).toBe(true);
    expect(isClassAttributeContext('<div v-bind:class="', TOKEN)).toBe(true);
    expect(isClassAttributeContext("<div :class=\"{ 'a': x, '", TOKEN)).toBe(true);
  });

  it("Svelte class directive (token carries the attribute)", () => {
    expect(isClassAttributeContext("<div ", "class:p-16px")).toBe(true);
  });

  it("multi-line class strings", () => {
    const prefix = '<div\n  className="\n  flex\n  ';
    expect(isClassAttributeContext(prefix, TOKEN)).toBe(true);
  });
});

describe("isClassAttributeContext — class utility functions", () => {
  it("treats configured function arguments as class context", () => {
    expect(isClassAttributeContext('clsx("', TOKEN)).toBe(true);
    expect(isClassAttributeContext("cn('flex', '", TOKEN)).toBe(true);
    expect(isClassAttributeContext('cva("base", { variants: "', TOKEN)).toBe(true);
    expect(isClassAttributeContext('cn(clsx("a"), "', TOKEN)).toBe(true);
  });

  it("respects a custom function list", () => {
    expect(isClassAttributeContext('myClasses("', TOKEN, ["myClasses"])).toBe(true);
    expect(isClassAttributeContext('clsx("', TOKEN, ["myClasses"])).toBe(false);
  });

  it("ignores unrelated function calls", () => {
    expect(isClassAttributeContext('console.log("', TOKEN)).toBe(false);
    expect(isClassAttributeContext('fetch("', TOKEN)).toBe(false);
  });
});

describe("isClassAttributeContext — outside class context", () => {
  it("plain JS strings are ignored", () => {
    expect(isClassAttributeContext('const value = "', TOKEN)).toBe(false);
    expect(isClassAttributeContext("const value = 'prefix ", TOKEN)).toBe(false);
  });

  it("comments and bare text are ignored", () => {
    expect(isClassAttributeContext("// ", TOKEN)).toBe(false);
    expect(isClassAttributeContext("<span>content ", TOKEN)).toBe(false);
  });

  it("unrelated attributes are ignored", () => {
    expect(isClassAttributeContext('<a href="', TOKEN)).toBe(false);
    expect(isClassAttributeContext('<img alt="', TOKEN)).toBe(false);
  });
});
