import * as vscode from "vscode";
import { SettingsStore, DEFAULT_LANGUAGES } from "./settings";
import { Logger } from "./logger";
import { ChangeHandler } from "./changeHandler";
import { ThemeProvider } from "./theme/themeProvider";
import { HoverProvider } from "./hover";
import { VisualFeedback } from "./visualFeedback";
import { StatusBar } from "./statusBar";
import { registerCommands } from "./commands";
import { SaveHandler } from "./saveHandler";
import { DiagnosticsProvider } from "./diagnostics";
import { ConvertCodeActionProvider } from "./codeActions";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger();
  const settings = new SettingsStore();
  const themeProvider = new ThemeProvider(settings, logger);
  const visualFeedback = new VisualFeedback(settings);
  const statusBar = new StatusBar(settings);

  const getContext = () => themeProvider.current;

  const changeHandler = new ChangeHandler(
    settings,
    () => settings.converterOptions(getContext()),
    logger,
    (editor, range) => visualFeedback.flash(editor, [range]),
  );

  const hoverProvider = new HoverProvider(settings, getContext);
  const hoverRegistration = vscode.languages.registerHoverProvider(
    DEFAULT_LANGUAGES,
    hoverProvider,
  );

  const saveHandler = new SaveHandler(settings, getContext, logger);
  const diagnostics = new DiagnosticsProvider(settings, getContext);
  const codeActionRegistration = vscode.languages.registerCodeActionsProvider(
    DEFAULT_LANGUAGES,
    new ConvertCodeActionProvider(),
    { providedCodeActionKinds: ConvertCodeActionProvider.providedCodeActionKinds },
  );

  registerCommands(context, {
    settings,
    logger,
    visualFeedback,
    getContext,
    onToggle: () => statusBar.update(),
  });

  context.subscriptions.push(
    settings.onDidChange(() => void themeProvider.reload()),
    logger,
    settings,
    themeProvider,
    visualFeedback,
    statusBar,
    changeHandler,
    hoverRegistration,
    saveHandler,
    diagnostics,
    codeActionRegistration,
  );

  void themeProvider.reload();
  logger.info(`Activated (mode: ${settings.current.mode}).`);
}

export function deactivate(): void {
  // Disposables registered on the extension context are cleaned up by VS Code.
}
