import * as assert from 'assert';
import * as vscode from 'vscode';
import { TextProcessor } from '../textProcessor';
import { TailwindConverter } from '../tailwindConverter';
import { ConfigurationManager } from '../configManager';
import { VisualFeedbackHandler } from '../visualFeedback';

suite('Visual Feedback Integration Tests', () => {
    let processor: TextProcessor;
    let converter: TailwindConverter;
    let configManager: ConfigurationManager;
    let feedbackHandler: VisualFeedbackHandler;

    setup(() => {
        converter = new TailwindConverter();
        configManager = new ConfigurationManager();
        processor = new TextProcessor(converter, configManager);
        feedbackHandler = new VisualFeedbackHandler(configManager);
    });

    teardown(() => {
        processor.dispose();
        configManager.dispose();
        feedbackHandler.dispose();
    });

    suite('end-to-end visual feedback workflow', () => {
        test('should integrate visual feedback with text processing', () => {
            const htmlContent = '<div class="p-16px m-8px w-100px">Content</div>';
            const range = new vscode.Range(0, 0, 0, htmlContent.length);
            
            // Find pixel classes
            const matches = processor.findPixelClasses(htmlContent, range);
            
            // Verify matches found
            assert.strictEqual(matches.length, 3);
            
            // Create mock editor
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;
            
            // Should be able to show visual feedback
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, matches);
            });
        });

        test('should handle different conversion types with appropriate feedback', () => {
            const complexHtml = `
                <div class="p-16px m-17px w-32px h-100px">
                    <span class="gap-x-12px gap-y-25px">Content</span>
                </div>
            `;
            
            const range = new vscode.Range(0, 0, 4, 0);
            const matches = processor.findPixelClasses(complexHtml, range);
            
            // Should find both standard and custom conversions
            const standardMatches = matches.filter(m => !m.isCustomValue);
            const customMatches = matches.filter(m => m.isCustomValue);
            
            assert.ok(standardMatches.length > 0, 'Should have standard conversions');
            assert.ok(customMatches.length > 0, 'Should have custom conversions');
            
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;
            
            // Should handle mixed conversion types
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, matches);
            });
        });
    });

    suite('configuration-driven feedback', () => {
        test('should respect visual feedback configuration', () => {
            const matches = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            // Should work when visual feedback is enabled (default)
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, matches);
            });

            // Should handle configuration updates
            assert.doesNotThrow(() => {
                feedbackHandler.updateFromConfiguration();
            });
        });

        test('should clear decorations when feedback is disabled', () => {
            // Clear all decorations
            feedbackHandler.clearAllDecorations();
            
            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.totalDecorations, 0);
            
            // Should handle configuration changes
            assert.doesNotThrow(() => {
                feedbackHandler.updateFromConfiguration();
            });
        });
    });

    suite('multi-editor scenarios', () => {
        test('should handle feedback across multiple editors', () => {
            const matches = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            const editors = [
                {
                    document: { uri: vscode.Uri.file('/test1.html') },
                    setDecorations: () => {}
                },
                {
                    document: { uri: vscode.Uri.file('/test2.html') },
                    setDecorations: () => {}
                },
                {
                    document: { uri: vscode.Uri.file('/test3.html') },
                    setDecorations: () => {}
                }
            ] as any[];

            // Should handle multiple editors
            editors.forEach(editor => {
                assert.doesNotThrow(() => {
                    feedbackHandler.showConversionFeedback(editor, matches);
                });
            });
        });

        test('should track decorations across editors', () => {
            const initialStats = feedbackHandler.getDecorationStats();
            
            // Stats should be consistent
            assert.strictEqual(typeof initialStats.activeEditors, 'number');
            assert.strictEqual(typeof initialStats.totalDecorations, 'number');
            assert.strictEqual(typeof initialStats.standardDecorations, 'number');
            assert.strictEqual(typeof initialStats.customDecorations, 'number');
        });
    });

    suite('performance and cleanup', () => {
        test('should clean up decorations efficiently', () => {
            // Add some decorations
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            const matches = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            feedbackHandler.showConversionFeedback(mockEditor, matches);
            
            // Clear all decorations
            const startTime = Date.now();
            feedbackHandler.clearAllDecorations();
            const endTime = Date.now();
            
            // Should complete quickly
            const duration = endTime - startTime;
            assert.ok(duration < 50, `Cleanup took ${duration}ms, should be under 50ms`);
            
            // Should have no active decorations
            const stats = feedbackHandler.getDecorationStats();
            assert.strictEqual(stats.totalDecorations, 0);
        });

        test('should handle rapid decoration updates', () => {
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            const matches = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            // Rapid updates should not cause issues
            const startTime = Date.now();
            for (let i = 0; i < 20; i++) {
                feedbackHandler.showConversionFeedback(mockEditor, matches);
            }
            const endTime = Date.now();
            
            // Should handle rapid updates efficiently
            const duration = endTime - startTime;
            assert.ok(duration < 100, `Rapid updates took ${duration}ms, should be under 100ms`);
        });
    });

    suite('error recovery', () => {
        test('should recover from editor errors gracefully', () => {
            const errorEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {
                    throw new Error('Mock editor error');
                }
            } as any;

            const matches = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(0, 0, 0, 6),
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            // Should handle editor errors gracefully
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(errorEditor, matches);
            });
        });

        test('should handle invalid ranges gracefully', () => {
            const mockEditor = {
                document: {
                    uri: vscode.Uri.file('/test.html')
                },
                setDecorations: () => {}
            } as any;

            const invalidMatches = [
                {
                    originalText: 'p-16px',
                    convertedText: 'p-4',
                    range: new vscode.Range(-1, -1, -1, -1), // Invalid range
                    property: 'p',
                    pixelValue: 16,
                    isCustomValue: false
                }
            ];

            // Should handle invalid ranges gracefully
            assert.doesNotThrow(() => {
                feedbackHandler.showConversionFeedback(mockEditor, invalidMatches);
            });
        });
    });

    suite('integration with text processor', () => {
        test('should integrate seamlessly with text processing workflow', () => {
            // This tests the integration between TextProcessor and VisualFeedbackHandler
            // through the configuration manager
            
            const htmlContent = '<div class="p-16px m-8px">Content</div>';
            const range = new vscode.Range(0, 0, 0, htmlContent.length);
            
            // Process the content
            const matches = processor.findPixelClasses(htmlContent, range);
            
            // Should find matches
            assert.ok(matches.length > 0);
            
            // Configuration should be accessible
            assert.ok(configManager.shouldShowVisualFeedback() !== undefined);
        });
    });
});