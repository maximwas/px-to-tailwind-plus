import * as vscode from "vscode";
import type { SettingsStore } from "./settings";

const HIGHLIGHT_DURATION_MS = 1200;

interface EditorHighlight {
  ranges: vscode.Range[];
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Briefly highlights converted ranges. Controlled by the
 * `pxToTwPlus.showVisualFeedback` setting.
 */
export class VisualFeedback implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly highlights = new Map<string, EditorHighlight>();

  constructor(private readonly settings: SettingsStore) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
      borderRadius: "3px",
    });
  }

  flash(editor: vscode.TextEditor, ranges: vscode.Range[]): void {
    if (!this.settings.current.showVisualFeedback || ranges.length === 0) {
      return;
    }

    const key = editor.document.uri.toString();
    const existing = this.highlights.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const merged = [...(existing?.ranges ?? []), ...ranges];
    editor.setDecorations(this.decorationType, merged);

    const timer = setTimeout(() => {
      editor.setDecorations(this.decorationType, []);
      this.highlights.delete(key);
    }, HIGHLIGHT_DURATION_MS);

    this.highlights.set(key, { ranges: merged, timer });
  }

  dispose(): void {
    this.highlights.forEach((highlight) => clearTimeout(highlight.timer));
    this.highlights.clear();
    this.decorationType.dispose();
  }
}
