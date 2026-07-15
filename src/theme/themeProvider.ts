import * as vscode from "vscode";
import type { ConversionContext, SettingsStore } from "../settings";
import type { Logger } from "../logger";
import { parseTailwindConfigSource, parseThemeCss } from "./parse";
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

    for (const file of files) {
      const spacing = await this.readSingleConfig(file);
      Object.assign(customSpacing, spacing);
    }

    if (Object.keys(customSpacing).length > 0) {
      this.logger.info(
        `Loaded ${Object.keys(customSpacing).length} custom spacing token(s) from tailwind.config.`,
      );
    }
    return { customSpacing };
  }

  private async readSingleConfig(
    file: vscode.Uri,
  ): Promise<Record<string, number>> {
    const isRequireable = /\.(js|cjs)$/.test(file.fsPath);
    if (isRequireable) {
      const viaChild = await readConfigViaChildProcess(file.fsPath);
      if (viaChild && Object.keys(viaChild).length > 0) {
        return viaChild;
      }
    }
    // Fallback: parse the source without executing it (covers .ts/.mjs too).
    const source = await this.readFileText(file);
    return source ? parseTailwindConfigSource(source) : {};
  }

  private async readV4Css(): Promise<ConversionContext> {
    const files = await vscode.workspace.findFiles(
      CSS_GLOB,
      EXCLUDE_GLOB,
      MAX_CSS_FILES,
    );
    const customSpacing: Record<string, number> = {};
    let spacingBasePx: number | undefined;

    for (const file of files) {
      const source = await this.readFileText(file);
      if (!source || !source.includes("@theme")) {
        continue;
      }
      const parsed = parseThemeCss(source);
      Object.assign(customSpacing, parsed.customSpacing);
      if (parsed.spacingBasePx !== undefined) {
        spacingBasePx = parsed.spacingBasePx;
      }
    }

    if (Object.keys(customSpacing).length > 0 || spacingBasePx !== undefined) {
      this.logger.info(
        `Loaded theme from CSS @theme (tokens: ${Object.keys(customSpacing).length}` +
          `${spacingBasePx !== undefined ? `, --spacing: ${spacingBasePx}px` : ""}).`,
      );
    }
    return spacingBasePx !== undefined
      ? { customSpacing, spacingBasePx }
      : { customSpacing };
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
