import * as vscode from 'vscode';

export interface ExtensionConfig {
    enabled: boolean;
    supportedFileTypes: string[];
    customSpacingScale?: Record<string, number>;
    showVisualFeedback: boolean;
    showHoverTooltips: boolean;
}

export interface PixelClassMatch {
    originalText: string;
    convertedText: string;
    range: vscode.Range;
    property: string;
    pixelValue: number;
    isCustomValue: boolean;
}

export interface ITailwindConverter {
    convertPixelClass(className: string): string | null;
    isPixelClass(className: string): boolean;
    getPixelValue(tailwindClass: string): number | null;
}

export interface ITextProcessor {
    processDocumentChange(event: vscode.TextDocumentChangeEvent): void;
    findPixelClasses(text: string, range: vscode.Range): PixelClassMatch[];
    replacePixelClasses(document: vscode.TextDocument, matches: PixelClassMatch[]): void;
}