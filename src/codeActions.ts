import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "./diagnostics";
import { CONVERT_FILE_COMMAND } from "./commands";

/**
 * Quick fixes for the px-class diagnostics: convert a single class or the whole
 * file.
 */
export class ConvertCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (
        diagnostic.source !== DIAGNOSTIC_SOURCE ||
        typeof diagnostic.code !== "string"
      ) {
        continue;
      }
      const fix = new vscode.CodeAction(
        `Convert to ${diagnostic.code}`,
        vscode.CodeActionKind.QuickFix,
      );
      fix.diagnostics = [diagnostic];
      fix.isPreferred = true;
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(document.uri, diagnostic.range, diagnostic.code);
      actions.push(fix);
    }

    if (actions.length > 0) {
      const convertAll = new vscode.CodeAction(
        "Convert all px classes in file",
        vscode.CodeActionKind.QuickFix,
      );
      convertAll.command = {
        command: CONVERT_FILE_COMMAND,
        title: "Convert File",
      };
      actions.push(convertAll);
    }

    return actions;
  }
}
