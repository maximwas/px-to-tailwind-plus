import * as vscode from "vscode";
import { findConversions } from "./bulkConvert";
import type { SettingsStore, ConversionContext } from "./settings";
import type { Logger } from "./logger";
import type { VisualFeedback } from "./visualFeedback";

export const TOGGLE_COMMAND = "pxToTwPlus.toggle";
export const CONVERT_FILE_COMMAND = "pxToTwPlus.convertFile";
export const CONVERT_SELECTION_COMMAND = "pxToTwPlus.convertSelection";
export const SHOW_LOGS_COMMAND = "pxToTwPlus.showLogs";

export interface CommandDependencies {
  settings: SettingsStore;
  logger: Logger;
  visualFeedback: VisualFeedback;
  getContext: () => ConversionContext;
  onToggle: () => void;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(TOGGLE_COMMAND, async () => {
      const next = !deps.settings.current.enabled;
      await deps.settings.setEnabled(next);
      deps.onToggle();
      vscode.window.showInformationMessage(
        `Px to Tailwind Plus ${next ? "enabled" : "disabled"}.`,
      );
    }),
    vscode.commands.registerCommand(SHOW_LOGS_COMMAND, () => deps.logger.show()),
    vscode.commands.registerCommand(CONVERT_FILE_COMMAND, () =>
      convertActiveEditor(deps, false),
    ),
    vscode.commands.registerCommand(CONVERT_SELECTION_COMMAND, () =>
      convertActiveEditor(deps, true),
    ),
  );
}

async function convertActiveEditor(
  deps: CommandDependencies,
  selectionOnly: boolean,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  if (deps.settings.isIgnoredFile(document.uri)) {
    vscode.window.showInformationMessage(
      "Px to Tailwind Plus: this file is excluded by pxToTwPlus.ignoreFiles.",
    );
    return;
  }

  const options = deps.settings.converterOptions(deps.getContext());
  const ranges: vscode.Range[] =
    selectionOnly && editor.selections.some((selection) => !selection.isEmpty)
      ? editor.selections.filter((selection) => !selection.isEmpty)
      : [new vscode.Range(0, 0, document.lineCount, 0)];

  const edit = new vscode.WorkspaceEdit();
  const convertedRanges: vscode.Range[] = [];
  let count = 0;

  for (const range of ranges) {
    const baseOffset = document.offsetAt(range.start);
    const text = document.getText(range);
    for (const conversion of findConversions(
      text,
      options,
      deps.settings.current.classFunctions,
    )) {
      if (conversion.kind !== "convert") {
        continue;
      }
      const start = document.positionAt(baseOffset + conversion.start);
      const end = document.positionAt(baseOffset + conversion.end);
      edit.replace(document.uri, new vscode.Range(start, end), conversion.output);
      convertedRanges.push(
        new vscode.Range(start, start.translate(0, conversion.output.length)),
      );
      count++;
    }
  }

  if (count === 0) {
    vscode.window.showInformationMessage("Px to Tailwind Plus: nothing to convert.");
    return;
  }

  const applied = await vscode.workspace.applyEdit(edit);
  if (applied) {
    deps.logger.info(`Converted ${count} class${count === 1 ? "" : "es"}.`);
    deps.visualFeedback.flash(editor, convertedRanges);
    vscode.window.showInformationMessage(
      `Px to Tailwind Plus: converted ${count} class${count === 1 ? "" : "es"}.`,
    );
  }
}
