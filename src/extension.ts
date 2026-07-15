import * as vscode from "vscode";
import { SettingsStore } from "./settings";
import { Logger } from "./logger";
import { ChangeHandler } from "./changeHandler";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  const settings = new SettingsStore();

  const changeHandler = new ChangeHandler(
    settings,
    () => settings.converterOptions(),
    logger,
  );

  context.subscriptions.push(logger, settings, changeHandler);
  logger.info(`Activated (mode: ${settings.current.mode}).`);
}

export function deactivate(): void {
  // Disposables registered on the extension context are cleaned up by VS Code.
}
