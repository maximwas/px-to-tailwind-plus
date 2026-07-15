import * as vscode from "vscode";
import { describeClass } from "./core";
import type { SettingsStore, ConversionContext } from "./settings";

/** Matches a spacing class token, including arbitrary `[Npx]` and `px`. */
const CLASS_TOKEN_RE = /-?[a-z][\w-]*-(?:\[-?\d*\.?\d+px\]|px|\d[\d.]*)/i;

/**
 * Shows `padding: 1rem /* 16px *\/`-style tooltips for spacing classes,
 * resolving values through the pure describeClass() using current settings and
 * theme context.
 */
export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private readonly settings: SettingsStore,
    private readonly getContext: () => ConversionContext,
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    if (!this.settings.current.showHoverTooltips) {
      return undefined;
    }
    if (!this.settings.isSupportedLanguage(document.languageId)) {
      return undefined;
    }

    const wordRange = document.getWordRangeAtPosition(position, CLASS_TOKEN_RE);
    if (!wordRange) {
      return undefined;
    }

    const token = document.getText(wordRange);
    const options = this.settings.converterOptions(this.getContext());
    const description = describeClass(token, options);
    if (!description) {
      return undefined;
    }

    const remText = formatNumber(description.rem);
    const pxText = formatNumber(description.px);
    const markdown = new vscode.MarkdownString();
    markdown.appendCodeblock(
      `${description.cssProperty}: ${remText}rem; /* ${pxText}px */`,
      "css",
    );
    return new vscode.Hover(markdown, wordRange);
  }
}

function formatNumber(value: number): string {
  return parseFloat(value.toFixed(6)).toString();
}
