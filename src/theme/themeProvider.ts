import * as vscode from "vscode";
import type { ConversionContext, SettingsStore } from "../settings";
import type { Logger } from "../logger";
import {
  parseTailwindConfigSource,
  parseThemeCss,
  type ConfigTokens,
} from "./parse";
import { readConfigViaChildProcess } from "./childConfigReader";

const CONFIG_GLOB = "**/tailwind.config.{js,cjs,mjs,ts}";
const CSS_GLOB = "**/*.css";
const EXCLUDE_GLOB = "{**/node_modules/**,**/dist/**,**/build/**,**/.next/**,**/out/**}";
const MAX_CONFIG_FILES = 8;
const MAX_CSS_FILES = 120;
const MAX_FILE_BYTES = 512 * 1024;
const RELOAD_DEBOUNCE_MS = 300;

/**
 * Reads project theme data (custom spacing + `--spacing` base) from the
 * workspace, caches it, and reloads on relevant file changes. The current
 * context is exposed synchronously so the change handler stays fast.
 */
export class ThemeProvider implements vscode.Disposable {
  private context: ConversionContext = {};
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private readonly disposables: vscode.Disposable[] = [];
  private reloadTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly settings: SettingsStore,
    private readonly logger: Logger,
  ) {
    this.setupWatchers();
  }

  /** Synchronously accessible, cached theme context. */
  get current(): ConversionContext {
    return this.context;
  }

  async reload(): Promise<void> {
    try {
      this.context =
        this.settings.current.mode === "v3"
          ? await this.readV3Config()
          : await this.readV4Css();
      this.emitter.fire();
    } catch (error) {
      this.logger.error("Theme reload failed", error);
      this.context = {};
    }
  }

  private async readV3Config(): Promise<ConversionContext> {
    const files = await vscode.workspace.findFiles(
      CONFIG_GLOB,
      EXCLUDE_GLOB,
      MAX_CONFIG_FILES,
    );
    const customSpacing: Record<string, number> = {};
    const customFontSize: Record<string, number> = {};
    const customRadius: Record<string, number> = {};

    for (const file of files) {
      const tokens = await this.readSingleConfig(file);
      Object.assign(customSpacing, tokens.spacing);
      Object.assign(customFontSize, tokens.fontSize);
      Object.assign(customRadius, tokens.radius);
    }

    const total =
      Object.keys(customSpacing).length +
      Object.keys(customFontSize).length +
      Object.keys(customRadius).length;
    if (total > 0) {
      this.logger.info(
        `Loaded ${total} custom token(s) from tailwind.config ` +
          `(spacing: ${Object.keys(customSpacing).length}, ` +
          `fontSize: ${Object.keys(customFontSize).length}, ` +
          `radius: ${Object.keys(customRadius).length}).`,
      );
    }
    return { customSpacing, customFontSize, customRadius };
  }

  private async readSingleConfig(file: vscode.Uri): Promise<ConfigTokens> {
    const empty: ConfigTokens = { spacing: {}, fontSize: {}, radius: {} };
    const isRequireable = /\.(js|cjs)$/.test(file.fsPath);
    if (isRequireable) {
      const viaChild = await readConfigViaChildProcess(file.fsPath);
      if (viaChild && hasTokens(viaChild)) {
        return viaChild;
      }
    }
    // Fallback: parse the source without executing it (covers .ts/.mjs too).
    const source = await this.readFileText(file);
    return source ? parseTailwindConfigSource(source) : empty;
  }

  private async readV4Css(): Promise<ConversionContext> {
    const files = await vscode.workspace.findFiles(
      CSS_GLOB,
      EXCLUDE_GLOB,
      MAX_CSS_FILES,
    );
    const customSpacing: Record<string, number> = {};
    const customFontSize: Record<string, number> = {};
    const customRadius: Record<string, number> = {};
    let spacingBasePx: number | undefined;

    for (const file of files) {
      const source = await this.readFileText(file);
      if (!source || !source.includes("@theme")) {
        continue;
      }
      const parsed = parseThemeCss(source);
      Object.assign(customSpacing, parsed.customSpacing);
      Object.assign(customFontSize, parsed.customFontSize);
      Object.assign(customRadius, parsed.customRadius);
      if (parsed.spacingBasePx !== undefined) {
        spacingBasePx = parsed.spacingBasePx;
      }
    }

    const total =
      Object.keys(customSpacing).length +
      Object.keys(customFontSize).length +
      Object.keys(customRadius).length;
    if (total > 0 || spacingBasePx !== undefined) {
      this.logger.info(
        `Loaded theme from CSS @theme (tokens: ${total}` +
          `${spacingBasePx !== undefined ? `, --spacing: ${spacingBasePx}px` : ""}).`,
      );
    }
    return spacingBasePx !== undefined
      ? { customSpacing, customFontSize, customRadius, spacingBasePx }
      : { customSpacing, customFontSize, customRadius };
  }

  private async readFileText(file: vscode.Uri): Promise<string | null> {
    try {
      const bytes = await vscode.workspace.fs.readFile(file);
      if (bytes.byteLength > MAX_FILE_BYTES) {
        return null;
      }
      return Buffer.from(bytes).toString("utf8");
    } catch {
      return null;
    }
  }

  private setupWatchers(): void {
    const configWatcher = vscode.workspace.createFileSystemWatcher(CONFIG_GLOB);
    const cssWatcher = vscode.workspace.createFileSystemWatcher(CSS_GLOB);
    for (const watcher of [configWatcher, cssWatcher]) {
      watcher.onDidChange(() => this.scheduleReload());
      watcher.onDidCreate(() => this.scheduleReload());
      watcher.onDidDelete(() => this.scheduleReload());
      this.disposables.push(watcher);
    }
  }

  private scheduleReload(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => void this.reload(), RELOAD_DEBOUNCE_MS);
  }

  dispose(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.emitter.dispose();
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
  }
}

/** True when a config produced at least one usable token. */
function hasTokens(tokens: ConfigTokens): boolean {
  return (
    Object.keys(tokens.spacing).length > 0 ||
    Object.keys(tokens.fontSize).length > 0 ||
    Object.keys(tokens.radius).length > 0
  );
}
