import * as vscode from "vscode";
import { SettingsStore } from "./settings";
import { Logger } from "./logger";
import { ChangeHandler } from "./changeHandler";
import { ThemeProvider } from "./theme/themeProvider";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  const settings = new SettingsStore();
  const themeProvider = new ThemeProvider(settings, logger);

  const changeHandler = new ChangeHandler(
    settings,
    () => settings.converterOptions(themeProvider.current),
    logger,
  );

  // Re-read the project theme whenever settings (e.g. mode) change.
  context.subscriptions.push(
    settings.onDidChange(() => void themeProvider.reload()),
  );

  context.subscriptions.push(logger, settings, themeProvider, changeHandler);

  void themeProvider.reload();
  logger.info(`Activated (mode: ${settings.current.mode}).`);
}

export function deactivate(): void {
  // Disposables registered on the extension context are cleaned up by VS Code.
}
