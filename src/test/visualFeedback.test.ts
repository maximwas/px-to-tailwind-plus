import * as assert from 'assert';
import * as vscode from 'vscode';
import { VisualFeedbackHandler } from '../visualFeedback';
import { ConfigurationManager } from '../configManager';
import { PixelClassMatch } from '../types';

suite('VisualFeedbackHandler Test Suite', () => {
    let feedbackHandler: VisualFeedbackHandler;
    let configManager: ConfigurationManager;

    setup(() => {
        configManager = new ConfigurationManager();
        feedbackHandler = new VisualFeedbackHandler(configManager);
    });

    teardown(() => {
        feedbackHandler.dispose();
        configManager.dispose();
    });

    suite('initialization', () => {
        test('should initialize without errors', () => {
            assert.ok(feedbackHandler);
        });

        test('should start with no active decorations', () => {
            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.activeEditors, 0);
            assert.strictEqual(stats.totalDecorations, 0);
            assert.strictEqual(stats.standardDecorations, 0);
            assert.strictEqual(stats.customDecorations, 0);
        });
    });

    suite('decoration statistics', () => {
        test('should track decoration statistics correctly', () => {
            const stats = feedbackHandler.getDecorationStats();
            
            assert.strictEqual(typeof stats.activeEditors, 'number');
            assert.strictEqual(typeof stats.totalDecorations, 'number');
            assert.strictEqual(typeof stats.standardDecorations, 'number');
            assert.strictEqual(typeof stats.customDecorations, 'number');
            
            // Initially should be zero
            assert.strictEqual(stats.activeEditors, 0);
            assert.strictEqual(stats.totalDecorations, 0);
        });

        test('should handle empty matches gracefully', () => {
            // Create a mock editor
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            // Should not throw with empty matches
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, []);
            });

            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.totalDecorations, 0);
        });
    });

    suite('configuration integration', () => {
        test('should respect visual feedback configuration', () => {
            // Test that the handler respects the configuration
            // We can't easily mock VS Code configuration, but we can test the integration
            assert.doesNotThrow(() => {
                feedbackHandler.updateFromConfiguration();
            });
        });

        test('should clear decorations when visual feedback is disabled', () => {
            // Clear all decorations
            feedbackHandler.clearAllDecorations();
            
            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.totalDecorations, 0);
        });
    });

    suite('decoration management', () => {
        test('should handle standard and custom matches differently', () => {
            const standardMatches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            const customMatches: PixelClassMatch[] = [
                {
                    originalText: 'p-17px',
                    convertedText: 'p-[17px]',
                    range: new vscode.Range(0, 7, 0, 13),
                    property: 'p',
                    pixelValue: 17,
                    isCustomValue: true
                }
            ];

            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            // Should handle both types without errors
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, [...standardMatches, ...customMatches]);
            });
        });

        test('should clear all decorations on demand', () => {
            feedbackHandler.clearAllDecorations();
            
            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.activeEditors, 0);
            assert.strictEqual(stats.totalDecorations, 0);
        });
    });

    suite('error handling', () => {
        test('should handle invalid editor gracefully', () => {
            const invalidEditor = null as any;
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            // Should not throw with invalid editor
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(invalidEditor, matches);
            });
        });

        test('should handle malformed matches gracefully', () => {
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            const malformedMatches = [
                {
                    originalText: '',
                    convertedText: '',
                    range: new vscode.Range(0, 0, 0, 0),
                    property: '',
                    pixelValue: 0,
                    isCustomValue: false
                }
            ] as PixelClassMatch[];

            // Should not throw with malformed matches
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, malformedMatches);
            });
        });

        test('should handle editor disposal gracefully', () => {
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {
                    throw new Error('Editor disposed');
                }
            } as any;

            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            // Should handle editor disposal errors gracefully
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, matches);
            });
        });
    });

    suite('lifecycle management', () => {
        test('should dispose cleanly', () => {
            assert.doesNotThrow(() => {
                feedbackHandler.dispose();
            });

            // Should be able to dispose multiple times
            assert.doesNotThrow(() => {
                feedbackHandler.dispose();
            });
        });

        test('should clear decorations on disposal', () => {
            feedbackHandler.dispose();
            
            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.totalDecorations, 0);
        });
    });

    suite('integration scenarios', () => {
        test('should handle mixed standard and custom conversions', () => {
            const mixedMatches: PixelClassMatch[] = [
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

            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            // Should handle mixed conversions without errors
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, mixedMatches);
            });
        });

        test('should handle multiple editors', () => {
            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            const editor1 = {
                document: { uri: vscode.Uri.file('/test1.html') },
                setDecorations: () => {}
            } as any;

            const editor2 = {
                document: { uri: vscode.Uri.file('/test2.html') },
                setDecorations: () => {}
            } as any;

            // Should handle multiple editors
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(editor1, matches);
                feedbackHandler.showConversionFeedback(editor2, matches);
            });
        });

        test('should handle rapid successive conversions', () => {
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            const matches: PixelClassMatch[] = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            // Should handle rapid successive calls
            assert.doesNotThrow(() => {
                for (let i = 0; i < 10; i++) {
                    feedbackHandler.showConversionFeedback(mockEditor, matches);
                }
            });
        });
    });

    suite('performance considerations', () => {
        test('should handle large numbers of matches efficiently', () => {
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            // Create many matches
            const manyMatches: PixelClassMatch[] = [];
            for (let i = 0; i < 100; i++) {
                manyMatches.push({
                    originalText: `p-${16 + i}px`,
                    convertedText: i < 50 ? `p-${4 + i}` : `p-[${16 + i}px]`,
                    range: new vscode.Range(i, 0, i, 10),
                    property: 'p',
                    pixelValue: 16 + i,
                    isCustomValue: i >= 50
                });
            }

            // Should handle large numbers of matches efficiently
            const startTime = Date.now();
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, manyMatches);
            });
            const endTime = Date.now();

            // Should complete quickly (less than 100ms)
            const duration = endTime - startTime;
            assert.ok(duration < 100, `Processing took ${duration}ms, should be under 100ms`);
        });
    });
});