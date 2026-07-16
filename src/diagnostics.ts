import * as vscode from "vscode";
import { findConversions } from "./bulkConvert";
import type { ConversionContext, SettingsStore } from "./settings";

export const DIAGNOSTIC_SOURCE = "Px to Tailwind Plus";
const REFRESH_DEBOUNCE_MS = 250;

/**
 * Flags px classes that can be converted with a Warning (yellow) squiggle so
 * the user sees the Tailwind equivalent is available. Pairs with the code
 * action provider for the quick fix.
 */
export class DiagnosticsProvider implements vscode.Disposable {
  private readonly collection =
    vscode.languages.createDiagnosticCollection("pxToTwPlus");
  private readonly disposables: vscode.Disposable[] = [];
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly settings: SettingsStore,
    private readonly getContext: () => ConversionContext,
  ) {
    this.disposables.push(
      this.collection,
      vscode.workspace.onDidChangeTextDocument((event) =>
        this.scheduleRefresh(event.document),
      ),
      vscode.workspace.onDidOpenTextDocument((document) =>
        this.refresh(document),
      ),
      vscode.workspace.onDidCloseTextDocument((document) =>
        this.collection.delete(document.uri),
      ),
      this.settings.onDidChange(() => this.refreshAll()),
    );
    this.refreshAll();
  }

  private scheduleRefresh(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.refresh(document);
      }, REFRESH_DEBOUNCE_MS),
    );
  }

  private refreshAll(): void {
    for (const document of vscode.workspace.textDocuments) {
      this.refresh(document);
    }
  }

  private refresh(document: vscode.TextDocument): void {
    const settings = this.settings.current;
    if (
      !settings.enabled ||
      !settings.showDiagnostics ||
      !this.settings.isSupportedLanguage(document.languageId) ||
      this.settings.isIgnoredFile(document.uri)
    ) {
      this.collection.delete(document.uri);
      return;
    }

    const options = this.settings.converterOptions(this.getContext());
    const diagnostics = findConversions(
      document.getText(),
      options,
      settings.classFunctions,
    ).map(
      (conversion) => {
        const range = new vscode.Range(
          document.positionAt(conversion.start),
          document.positionAt(conversion.end),
        );
        const isSnap = conversion.kind === "snap";
        // A snap changes the rendered value, so it is advice (blue), not the
        // exact-rewrite warning (yellow) that convert-on-save would apply.
        const diagnostic = new vscode.Diagnostic(
          range,
          isSnap
            ? `${conversion.original} → ${conversion.output} (nearest scale value)`
            : `${conversion.original} → ${conversion.output}`,
          isSnap
            ? vscode.DiagnosticSeverity.Information
            : vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = DIAGNOSTIC_SOURCE;
        diagnostic.code = conversion.output;
        return diagnostic;
      },
    );

    this.collection.set(document.uri, diagnostics);
  }

  dispose(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables.length = 0;
  }
}
