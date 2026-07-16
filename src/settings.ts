import * as vscode from "vscode";
import type { ConverterOptions, Mode, StepGranularity, ValueKind } from "./core";
import { DEFAULT_CLASS_FUNCTIONS } from "./classContext";
import { compileIgnorePatterns, isIgnoredPath } from "./ignoreFiles";
import type { Minimatch } from "minimatch";
import type { Logger } from "./logger";

const ARBITRARY_CATEGORIES: ValueKind[] = ["spacing", "direct", "fontSize", "radius"];

export const CONFIG_SECTION = "pxToTwPlus";

export const DEFAULT_LANGUAGES = [
  "html",
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "vue",
  "svelte",
  "astro",
  "css",
  "scss",
  "less",
  "postcss",
];

export interface Settings {
  enabled: boolean;
  mode: Mode;
  spacingBasePx: number;
  stepGranularity: StepGranularity;
  supportedLanguages: string[];
  arbitraryFor: ValueKind[];
  convertArbitraryBrackets: boolean;
  /** Glob patterns; files whose path matches any are skipped entirely. */
  ignoreFiles: string[];
  classFunctions: string[];
  convertWhileTyping: boolean;
  convertOnSave: boolean;
  showDiagnostics: boolean;
  showVisualFeedback: boolean;
  showHoverTooltips: boolean;
}

/** Extra per-document context, supplied by the theme reader (stage 4). */
export interface ConversionContext {
  customSpacing?: Record<string, number>;
  customFontSize?: Record<string, number>;
  customRadius?: Record<string, number>;
  /** Overrides spacingBasePx when a project defines a custom `--spacing`. */
  spacingBasePx?: number;
}

/**
 * The single source of truth for extension settings. Reads once, caches, and
 * re-reads only when the relevant configuration section changes.
 */
export class SettingsStore implements vscode.Disposable {
  private value: Settings;
  private ignoreMatchers: Minimatch[] = [];
  private readonly emitter = new vscode.EventEmitter<Settings>();
  readonly onDidChange = this.emitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly logger?: Logger) {
    this.value = SettingsStore.read();
    this.refreshIgnorePatterns();
    this.disposables.push(
      this.emitter,
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
          this.value = SettingsStore.read();
          this.refreshIgnorePatterns();
          this.emitter.fire(this.value);
        }
      }),
    );
  }

  get current(): Settings {
    return this.value;
  }

  isSupportedLanguage(languageId: string): boolean {
    return this.value.supportedLanguages.includes(languageId);
  }

  /** True when `ignoreFiles` excludes this document from every feature. */
  isIgnoredFile(uri: vscode.Uri): boolean {
    return isIgnoredPath(
      vscode.workspace.asRelativePath(uri, false),
      this.ignoreMatchers,
    );
  }

  private refreshIgnorePatterns(): void {
    const { matchers, invalid } = compileIgnorePatterns(this.value.ignoreFiles);
    this.ignoreMatchers = matchers;
    if (invalid.length > 0) {
      this.logger?.warn(
        `Ignoring invalid ignoreFiles pattern(s): ${invalid.join(", ")}`,
      );
    }
  }

  /** Builds converter options from settings plus optional theme context. */
  converterOptions(context?: ConversionContext): ConverterOptions {
    return {
      mode: this.value.mode,
      spacingBasePx: context?.spacingBasePx ?? this.value.spacingBasePx,
      stepGranularity: this.value.stepGranularity,
      customSpacing: context?.customSpacing,
      customFontSize: context?.customFontSize,
      customRadius: context?.customRadius,
      arbitraryFor: this.value.arbitraryFor,
      convertArbitraryBrackets: this.value.convertArbitraryBrackets,
    };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update("enabled", enabled, vscode.ConfigurationTarget.Global);
  }

  private static read(): Settings {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const mode = config.get<string>("mode", "v4") === "v3" ? "v3" : "v4";
    const rawBase = config.get<number>("spacingBasePx", 4);
    const spacingBasePx = Number.isFinite(rawBase) && rawBase > 0 ? rawBase : 4;
    const rawGranularity = config.get<number>("stepGranularity", 0.25);
    const stepGranularity: StepGranularity =
      rawGranularity === 1 || rawGranularity === 0.5
        ? (rawGranularity as StepGranularity)
        : 0.25;

    return {
      enabled: config.get<boolean>("enabled", true),
      mode,
      spacingBasePx,
      stepGranularity,
      supportedLanguages: config.get<string[]>(
        "supportedLanguages",
        DEFAULT_LANGUAGES,
      ),
      arbitraryFor: (config.get<string[]>("arbitraryFor", []) ?? []).filter(
        (candidate): candidate is ValueKind =>
          ARBITRARY_CATEGORIES.includes(candidate as ValueKind),
      ),
      convertArbitraryBrackets: config.get<boolean>(
        "convertArbitraryBrackets",
        true,
      ),
      ignoreFiles: config.get<string[]>("ignoreFiles", []) ?? [],
      classFunctions: config.get<string[]>(
        "classFunctions",
        DEFAULT_CLASS_FUNCTIONS,
      ),
      convertWhileTyping: config.get<boolean>("convertWhileTyping", true),
      convertOnSave: config.get<boolean>("convertOnSave", false),
      showDiagnostics: config.get<boolean>("showDiagnostics", true),
      showVisualFeedback: config.get<boolean>("showVisualFeedback", true),
      showHoverTooltips: config.get<boolean>("showHoverTooltips", true),
    };
  }

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
  }
}
