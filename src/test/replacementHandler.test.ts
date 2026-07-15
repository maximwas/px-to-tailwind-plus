import * as assert from 'assert';
import * as vscode from 'vscode';
import { ReplacementHandler } from '../replacementHandler';
import { PixelClassMatch } from '../types';

suite('ReplacementHandler Test Suite', () => {
    let handler: ReplacementHandler;

    setup(() => {
        handler = new ReplacementHandler();
    });

    suite('replacement statistics', () => {
        test('should calculate correct replacement statistics', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                },
                {
                    originalText: 'm-17px',
                    convertedText: 'm-[17px]',
                    range: new vscode.Range(0, 7, 0, 13),
                    property: 'm',
                    pixelValue: 17,
                    isCustomValue: true
                },
                {
                    originalText: 'w-32px',
                    convertedText: 'w-8',
                    range: new vscode.Range(0, 14, 0, 20),
                    property: 'w',
                    pixelValue: 32,
                    isCustomValue: false
                }
            ];

            const stats = handler.getReplacementStats(matches);

            assert.strictEqual(stats.total, 3);
            assert.strictEqual(stats.standard, 2);
            assert.strictEqual(stats.custom, 1);
            assert.strictEqual(stats.properties.size, 3);
            assert.ok(stats.properties.has('p'));
            assert.ok(stats.properties.has('m'));
            assert.ok(stats.properties.has('w'));
        });

        test('should handle empty matches array', () => {
            const stats = handler.getReplacementStats([]);

            assert.strictEqual(stats.total, 0);
            assert.strictEqual(stats.standard, 0);
            assert.strictEqual(stats.custom, 0);
            assert.strictEqual(stats.properties.size, 0);
        });

        test('should handle all custom values', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-17px',
                    convertedText: 'p-[17px]',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 17,
                    isCustomValue: true
                },
                {
                    originalText: 'm-25px',
                    convertedText: 'm-[25px]',
                    range: new vscode.Range(0, 7, 0, 13),
                    property: 'm',
                    pixelValue: 25,
                    isCustomValue: true
                }
            ];

            const stats = handler.getReplacementStats(matches);

            assert.strictEqual(stats.total, 2);
            assert.strictEqual(stats.standard, 0);
            assert.strictEqual(stats.custom, 2);
        });
    });

    suite('match validation', () => {
        test('should handle empty matches gracefully', async () => {
            // Create a mock document
            const mockDocument = {
                uri: vscode.Uri.file('/test.html'),
                lineCount: 1,
                getText: () => '',
                lineAt: () => ({ text: '' })
            } as any;

            const result = await handler.applyReplacements(mockDocument, []);
            assert.strictEqual(result, true);
        });

        test('should handle batch replacements with empty matches', async () => {
            const mockDocument = {
                uri: vscode.Uri.file('/test.html'),
                lineCount: 1,
                getText: () => '',
                lineAt: () => ({ text: '' })
            } as any;

            const result = await handler.applyBatchReplacements(mockDocument, []);
            assert.strictEqual(result, true);
        });
    });

    suite('undo/redo support', () => {
        test('should support undo/redo for saved documents', () => {
            const mockDocument = {
                isUntitled: false,
                isDirty: true
            } as vscode.TextDocument;

            const canUndo = handler.canUndoRedo(mockDocument);
            assert.strictEqual(canUndo, true);
        });

        test('should support undo/redo for dirty untitled documents', () => {
            const mockDocument = {
                isUntitled: true,
                isDirty: true
            } as vscode.TextDocument;

            const canUndo = handler.canUndoRedo(mockDocument);
            assert.strictEqual(canUndo, true);
        });

        test('should not support undo/redo for clean untitled documents', () => {
            const mockDocument = {
                isUntitled: true,
                isDirty: false
            } as vscode.TextDocument;

            const canUndo = handler.canUndoRedo(mockDocument);
            assert.strictEqual(canUndo, false);
        });
    });

    suite('error handling', () => {
        test('should handle invalid ranges gracefully', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(-1, 0, 0, 6), // Invalid line number
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            const stats = handler.getReplacementStats(matches);
            assert.strictEqual(stats.total, 1); // Should still process the match
        });

        test('should handle malformed matches', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: '',
                    convertedText: '',
                    range: new vscode.Range(0, 0, 0, 0),
                    property: '',
                    pixelValue: 0,
                    isCustomValue: false
                }
            ];

            const stats = handler.getReplacementStats(matches);
            assert.strictEqual(stats.total, 1);
            assert.strictEqual(stats.standard, 1);
            assert.strictEqual(stats.custom, 0);
        });
    });

    suite('performance considerations', () => {
        test('should handle large numbers of matches', () => {
            const matches: PixelClassMatch[] = [];
            
            // Create 100 matches
            for (let i = 0; i < 100; i++) {
                matches.push({
                    originalText: `p-${16 + i}px`,
                    convertedText: i < 50 ? `p-${4 + i}` : `p-[${16 + i}px]`,
                    range: new vscode.Range(i, 0, i, 10),
                    property: 'p',
                    pixelValue: 16 + i,
                    isCustomValue: i >= 50
                });
            }

            const stats = handler.getReplacementStats(matches);
            assert.strictEqual(stats.total, 100);
            assert.strictEqual(stats.standard, 50);
            assert.strictEqual(stats.custom, 50);
        });

        test('should handle matches across multiple lines', () => {
            const matches: PixelClassMatch[] = [];
            
            // Create matches on different lines
            for (let line = 0; line < 10; line++) {
                matches.push({
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(line, 0, line, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                });
            }

            const stats = handler.getReplacementStats(matches);
            assert.strictEqual(stats.total, 10);
            assert.strictEqual(stats.properties.size, 1);
        });
    });

    suite('integration scenarios', () => {
        test('should handle mixed standard and custom replacements', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                },
                {
                    originalText: 'm-17px',
                    convertedText: 'm-[17px]',
                    range: new vscode.Range(0, 7, 0, 13),
                    property: 'm',
                    pixelValue: 17,
                    isCustomValue: true
                },
                {
                    originalText: 'gap-x-24px',
                    convertedText: 'gap-x-6',
                    range: new vscode.Range(0, 14, 0, 24),
                    property: 'gap-x',
                    pixelValue: 24,
                    isCustomValue: false
                }
            ];

            const stats = handler.getReplacementStats(matches);
            assert.strictEqual(stats.total, 3);
            assert.strictEqual(stats.standard, 2);
            assert.strictEqual(stats.custom, 1);
            assert.strictEqual(stats.properties.size, 3);
        });

        test('should handle complex CSS properties', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'gap-x-16px',
                    convertedText: 'gap-x-4',
                    range: new vscode.Range(0, 0, 0, 10),
                    property: 'gap-x',
                    pixelValue: 16,
                    isCustomValue: false
                },
                {
                    originalText: 'gap-y-24px',
                    convertedText: 'gap-y-6',
                    range: new vscode.Range(0, 11, 0, 21),
                    property: 'gap-y',
                    pixelValue: 24,
                    isCustomValue: false
                }
            ];

            const stats = handler.getReplacementStats(matches);
            assert.ok(stats.properties.has('gap-x'));
            assert.ok(stats.properties.has('gap-y'));
        });
    });
});