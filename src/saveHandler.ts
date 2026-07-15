import * as vscode from "vscode";
import { findConversions } from "./bulkConvert";
import type { ConversionContext, SettingsStore } from "./settings";
import type { Logger } from "./logger";

/**
 * Converts every px class in a file as part of saving it, when
 * `pxToTwPlus.convertOnSave` is enabled. Uses onWillSave so the edits are
 * applied within the same save operation.
 */
export class SaveHandler implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly settings: SettingsStore,
    private readonly getContext: () => ConversionContext,
    private readonly logger: Logger,
  ) {
    this.disposables.push(
      vscode.workspace.onWillSaveTextDocument((event) => this.onWillSave(event)),
    );
  }

  private onWillSave(event: vscode.TextDocumentWillSaveEvent): void {
    const settings = this.settings.current;
    if (!settings.enabled || !settings.convertOnSave) {
      return;
    }
    if (!this.settings.isSupportedLanguage(event.document.languageId)) {
      return;
    }
    event.waitUntil(this.computeEdits(event.document));
  }

  private async computeEdits(
    document: vscode.TextDocument,
  ): Promise<vscode.TextEdit[]> {
    const options = this.settings.converterOptions(this.getContext());
    const edits = findConversions(
      document.getText(),
      options,
      this.settings.current.classFunctions,
    ).map((conversion) =>
      vscode.TextEdit.replace(
        new vscode.Range(
          document.positionAt(conversion.start),
          document.positionAt(conversion.end),
        ),
        conversion.output,
      ),
    );
    if (edits.length > 0) {
      this.logger.info(`Convert on save: ${edits.length} class(es).`);
    }
    return edits;
  }

  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
  }
}
