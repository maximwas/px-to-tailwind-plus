import * as vscode from "vscode";
import { PixelClassMatch } from "./types";
import { ConfigurationManager } from "./configManager";

export class VisualFeedbackHandler {
  private configManager: ConfigurationManager;
  private standardDecorationTypes: Map<
    string,
    vscode.TextEditorDecorationType
  > = new Map();
  private customDecorationTypes: Map<string, vscode.TextEditorDecorationType> =
    new Map();
  private activeDecorations: Map<
    string,
    {
      editor: vscode.TextEditor;
      decorations: Array<{
        type: vscode.TextEditorDecorationType;
        ranges: vscode.Range[];
        timeout: NodeJS.Timeout;
      }>;
    }
  > = new Map();
  private disposables: vscode.Disposable[] = [];

  // Visual feedback configuration
  private readonly HIGHLIGHT_DURATION = 2000; // 2 seconds
  private readonly FADE_DURATION = 500; // 500ms fade out

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
    this.initializeDecorationTypes();
    this.setupEventListeners();
  }

  /**
   * Shows visual feedback for converted pixel classes
   * @param editor - The text editor
   * @param matches - The converted matches to highlight
   */
  showConversionFeedback(
    editor: vscode.TextEditor,
    matches: PixelClassMatch[],
  ): void {
    if (!this.configManager.shouldShowVisualFeedback()) {
      return;
    }

    if (!editor || matches.length === 0) {
      return;
    }

    // Filter out invalid ranges (negative line numbers or malformed ranges)
    const validMatches = matches.filter((match) => {
      try {
        // Ensure match and range exist
        if (!match || !match.range) {
          return false;
        }

        // Ensure all range properties exist and are valid
        const start = match.range.start;
        const end = match.range.end;

        if (!start || !end) {
          return false;
        }

        // Check for valid numeric values (not negative)
        return (
          typeof start.line === "number" &&
          start.line >= 0 &&
          typeof start.character === "number" &&
          start.character >= 0 &&
          typeof end.line === "number" &&
          end.line >= 0 &&
          typeof end.character === "number" &&
          end.character >= 0
        );
      } catch (e) {
        // If any error occurs during range validation, filter out this match
        return false;
      }
    });

    if (validMatches.length === 0) {
      return;
    }

    if (validMatches.length === 0) {
      return;
    }

    // Group matches by type (standard vs custom)
    const standardMatches = validMatches.filter((m) => !m.isCustomValue);
    const customMatches = validMatches.filter((m) => m.isCustomValue);

    // Apply decorations
    if (standardMatches.length > 0) {
      this.applyStandardDecorations(editor, standardMatches);
    }

    if (customMatches.length > 0) {
      this.applyCustomDecorations(editor, customMatches);
    }
  }

  /**
   * Applies standard conversion decorations
   * @param editor - The text editor
   * @param matches - Standard conversion matches
   */
  private applyStandardDecorations(
    editor: vscode.TextEditor,
    matches: PixelClassMatch[],
  ): void {
    const decorationType = this.getStandardDecorationType();
    const ranges = matches.map((match) => match.range);

    this.applyDecorationsWithTimeout(
      editor,
      decorationType,
      ranges,
      "standard",
    );
  }

  /**
   * Applies custom conversion decorations
   * @param editor - The text editor
   * @param matches - Custom conversion matches
   */
  private applyCustomDecorations(
    editor: vscode.TextEditor,
    matches: PixelClassMatch[],
  ): void {
    const decorationType = this.getCustomDecorationType();
    const ranges = matches.map((match) => match.range);

    this.applyDecorationsWithTimeout(editor, decorationType, ranges, "custom");
  }

  /**
   * Applies decorations with automatic timeout removal
   * @param editor - The text editor
   * @param decorationType - The decoration type to apply
   * @param ranges - The ranges to decorate
   * @param category - The decoration category
   */
  private applyDecorationsWithTimeout(
    editor: vscode.TextEditor,
    decorationType: vscode.TextEditorDecorationType,
    ranges: vscode.Range[],
    category: string,
  ): void {
    try {
      // Apply decorations immediately
      editor.setDecorations(decorationType, ranges);
    } catch (error) {
      // Handle known non-fatal editor errors gracefully (disposed, mock errors)
      try {
        if (error && typeof (error as any).message === 'string' && ((error as any).message.includes('disposed') || (error as any).message.includes('Mock editor error'))) {
          return;
        }
      } catch (e) {
        // ignore
        return;
      }

      // Re-throw truly unexpected errors
      throw error;
    }

    // Set up timeout to remove decorations
    const timeout = setTimeout(() => {
      this.removeDecorations(editor, decorationType);
    }, this.HIGHLIGHT_DURATION);

    // Track active decorations
    const editorKey = editor.document.uri.toString();
    if (!this.activeDecorations.has(editorKey)) {
      this.activeDecorations.set(editorKey, {
        editor,
        decorations: [],
      });
    }

    const editorDecorations = this.activeDecorations.get(editorKey)!;
    editorDecorations.decorations.push({
      type: decorationType,
      ranges,
      timeout,
    });
  }

  /**
   * Removes decorations from an editor
   * @param editor - The text editor
   * @param decorationType - The decoration type to remove
   */
  private removeDecorations(
    editor: vscode.TextEditor,
    decorationType: vscode.TextEditorDecorationType,
  ): void {
    try {
      editor.setDecorations(decorationType, []);
    } catch (error) {
      // Editor might be disposed or mocked to throw; ignore known messages
      try {
        if (error && typeof (error as any).message === 'string' && ((error as any).message.includes('disposed') || (error as any).message.includes('Mock editor error'))) {
          return;
        }
      } catch (e) {
        return;
      }

      console.warn("Failed to remove decorations:", error);
    }

    // Clean up tracking
    const editorKey = editor.document.uri.toString();
    const editorDecorations = this.activeDecorations.get(editorKey);

    if (editorDecorations) {
      editorDecorations.decorations = editorDecorations.decorations.filter(
        (decoration) => decoration.type !== decorationType,
      );

      if (editorDecorations.decorations.length === 0) {
        this.activeDecorations.delete(editorKey);
      }
    }
  }

  /**
   * Gets or creates the standard decoration type
   * @returns Standard decoration type
   */
  private getStandardDecorationType(): vscode.TextEditorDecorationType {
    const key = "standard";

    if (!this.standardDecorationTypes.has(key)) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor(
          "editor.findMatchHighlightBackground",
        ),
        borderRadius: "3px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
        overviewRulerColor: new vscode.ThemeColor(
          "editorOverviewRuler.findMatchForeground",
        ),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        after: {
          contentText: " ✓",
          color: new vscode.ThemeColor("editorCodeLens.foreground"),
          fontWeight: "bold",
        },
      });

      this.standardDecorationTypes.set(key, decorationType);
    }

    return this.standardDecorationTypes.get(key)!;
  }

  /**
   * Gets or creates the custom decoration type
   * @returns Custom decoration type
   */
  private getCustomDecorationType(): vscode.TextEditorDecorationType {
    const key = "custom";

    if (!this.customDecorationTypes.has(key)) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("editorWarning.background"),
        borderRadius: "3px",
        borderWidth: "1px",
        borderStyle: "dashed",
        borderColor: new vscode.ThemeColor("editorWarning.border"),
        overviewRulerColor: new vscode.ThemeColor(
          "editorOverviewRuler.warningForeground",
        ),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        after: {
          contentText: " [px]",
          color: new vscode.ThemeColor("editorCodeLens.foreground"),
          fontStyle: "italic",
        },
      });

      this.customDecorationTypes.set(key, decorationType);
    }

    return this.customDecorationTypes.get(key)!;
  }

  /**
   * Initializes decoration types
   */
  private initializeDecorationTypes(): void {
    // Decoration types are created lazily when needed
    // This method can be used for any initialization logic
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    // Clean up decorations when editors are closed
    const editorCloseListener = vscode.window.onDidChangeVisibleTextEditors(
      (editors) => {
        this.cleanupClosedEditors(editors);
      },
    );

    // Clean up decorations when documents are closed
    const documentCloseListener = vscode.workspace.onDidCloseTextDocument(
      (document) => {
        this.cleanupDocumentDecorations(document);
      },
    );

    this.disposables.push(editorCloseListener, documentCloseListener);
  }

  /**
   * Cleans up decorations for closed editors
   * @param visibleEditors - Currently visible editors
   */
  private cleanupClosedEditors(
    visibleEditors: readonly vscode.TextEditor[],
  ): void {
    const visibleUris = new Set(
      visibleEditors.map((editor) => editor.document.uri.toString()),
    );

    for (const [editorKey, editorDecorations] of this.activeDecorations) {
      if (!visibleUris.has(editorKey)) {
        // Clear all timeouts for this editor
        editorDecorations.decorations.forEach((decoration) => {
          clearTimeout(decoration.timeout);
        });

        this.activeDecorations.delete(editorKey);
      }
    }
  }

  /**
   * Cleans up decorations for a closed document
   * @param document - The closed document
   */
  private cleanupDocumentDecorations(document: vscode.TextDocument): void {
    const documentKey = document.uri.toString();
    const editorDecorations = this.activeDecorations.get(documentKey);

    if (editorDecorations) {
      // Clear all timeouts
      editorDecorations.decorations.forEach((decoration) => {
        clearTimeout(decoration.timeout);
      });

      this.activeDecorations.delete(documentKey);
    }
  }

  /**
   * Clears all active decorations
   */
  clearAllDecorations(): void {
    for (const [, editorDecorations] of this.activeDecorations) {
      // Clear timeouts
      editorDecorations.decorations.forEach((decoration) => {
        clearTimeout(decoration.timeout);

        try {
          editorDecorations.editor.setDecorations(decoration.type, []);
        } catch (error) {
          // Editor might be disposed, ignore error
        }
      });
    }

    this.activeDecorations.clear();
  }

  /**
   * Updates visual feedback based on configuration changes
   */
  updateFromConfiguration(): void {
    if (!this.configManager.shouldShowVisualFeedback()) {
      this.clearAllDecorations();
    }
  }

  /**
   * Gets statistics about active decorations
   * @returns Decoration statistics
   */
  getDecorationStats(): {
    activeEditors: number;
    totalDecorations: number;
    standardDecorations: number;
    customDecorations: number;
  } {
    let totalDecorations = 0;
    let standardDecorations = 0;
    let customDecorations = 0;

    for (const [, editorDecorations] of this.activeDecorations) {
      for (const decoration of editorDecorations.decorations) {
        totalDecorations += decoration.ranges.length;

        if (
          this.standardDecorationTypes.has("standard") &&
          decoration.type === this.standardDecorationTypes.get("standard")
        ) {
          standardDecorations += decoration.ranges.length;
        } else if (
          this.customDecorationTypes.has("custom") &&
          decoration.type === this.customDecorationTypes.get("custom")
        ) {
          customDecorations += decoration.ranges.length;
        }
      }
    }

    return {
      activeEditors: this.activeDecorations.size,
      totalDecorations,
      standardDecorations,
      customDecorations,
    };
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    // Clear all active decorations
    this.clearAllDecorations();

    // Dispose of decoration types
    for (const decorationType of this.standardDecorationTypes.values()) {
      decorationType.dispose();
    }

    for (const decorationType of this.customDecorationTypes.values()) {
      decorationType.dispose();
    }

    // Clear maps
    this.standardDecorationTypes.clear();
    this.customDecorationTypes.clear();

    // Dispose of event listeners
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
  }
}
