import * as vscode from "vscode";
import { convertToken, type ConversionResult, type ConverterOptions } from "./core";
import {
  isClassAttributeContext,
  LOOKBACK_LINES,
  MAX_WINDOW_CHARS,
} from "./classContext";
import type { SettingsStore } from "./settings";
import type { Logger } from "./logger";

/** Characters that, when typed, mark the end of a class token. */
const BOUNDARY_TRIGGERS = new Set([" ", "\t", "\n", '"', "'", "`", "}"]);

/** Characters that delimit a token when scanning backwards. */
const TOKEN_STOPS = new Set([
  " ", "\t", "\n", "\r", '"', "'", "`", "{", "}", "<", ">", "=", "(", ")", ",", ";",
]);

export type OptionsResolver = (document: vscode.TextDocument) => ConverterOptions;

export type ConvertedCallback = (
  editor: vscode.TextEditor,
  range: vscode.Range,
  result: ConversionResult,
) => void;

/**
 * Watches document edits and rewrites completed px tokens inside class
 * attributes. A single WorkspaceEdit is used per conversion so a single undo
 * restores the typed px form, and a re-entrancy guard stops our own edits from
 * re-triggering the handler.
 */
export class ChangeHandler implements vscode.Disposable {
  private applying = false;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly settings: SettingsStore,
    private readonly resolveOptions: OptionsResolver,
    private readonly logger: Logger,
    private readonly onConverted?: ConvertedCallback,
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        void this.handleChange(event);
      }),
    );
  }

  private async handleChange(
    event: vscode.TextDocumentChangeEvent,
  ): Promise<void> {
    if (this.applying || !this.settings.current.enabled) {
      return;
    }

    const document = event.document;
    if (!this.settings.isSupportedLanguage(document.languageId)) {
      return;
    }

    // Only react to a single typed character that completes a token.
    if (event.contentChanges.length !== 1) {
      return;
    }
    const change = event.contentChanges[0];
    if (
      change.rangeLength !== 0 ||
      change.text.length !== 1 ||
      !BOUNDARY_TRIGGERS.has(change.text)
    ) {
      return;
    }

    const tokenEnd = change.range.start;
    const lineText = document.lineAt(tokenEnd.line).text;
    const endCharacter = tokenEnd.character;

    let startCharacter = endCharacter;
    while (startCharacter > 0 && !TOKEN_STOPS.has(lineText[startCharacter - 1])) {
      startCharacter--;
    }
    if (startCharacter === endCharacter) {
      return;
    }

    const token = lineText.slice(startCharacter, endCharacter);
    if (!token.endsWith("px")) {
      return;
    }

    const options = this.resolveOptions(document);
    const result = convertToken(token, options);
    if (!result) {
      return;
    }

    const tokenStart = new vscode.Position(tokenEnd.line, startCharacter);
    const prefix = this.lookbackPrefix(document, tokenStart);
    if (
      !isClassAttributeContext(prefix, token, this.settings.current.classFunctions)
    ) {
      return;
    }

    const range = new vscode.Range(tokenStart, tokenEnd);
    if (document.getText(range) !== token) {
      return;
    }

    await this.applyConversion(document, range, tokenStart, result);
  }

  /** Builds the text window preceding `tokenStart` for context detection. */
  private lookbackPrefix(
    document: vscode.TextDocument,
    tokenStart: vscode.Position,
  ): string {
    const fromLine = Math.max(0, tokenStart.line - LOOKBACK_LINES);
    const windowRange = new vscode.Range(
      new vscode.Position(fromLine, 0),
      tokenStart,
    );
    const prefix = document.getText(windowRange);
    return prefix.length > MAX_WINDOW_CHARS
      ? prefix.slice(-MAX_WINDOW_CHARS)
      : prefix;
  }

  private async applyConversion(
    document: vscode.TextDocument,
    range: vscode.Range,
    tokenStart: vscode.Position,
    result: ConversionResult,
  ): Promise<void> {
    this.applying = true;
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, result.output);
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        this.logger.warn(`Edit rejected for ${result.input}`);
        return;
      }

      this.logger.info(`${result.input} → ${result.output}`);

      const editor = vscode.window.activeTextEditor;
      if (this.onConverted && editor && editor.document === document) {
        const convertedRange = new vscode.Range(
          tokenStart,
          tokenStart.translate(0, result.output.length),
        );
        this.onConverted(editor, convertedRange, result);
      }
    } catch (error) {
      this.logger.error(`Failed to convert ${result.input}`, error);
    } finally {
      this.applying = false;
    }
  }

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
  }
}
