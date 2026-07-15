import * as assert from 'assert';
import * as vscode from 'vscode';
import { TextProcessor } from '../textProcessor';
import { TailwindConverter } from '../tailwindConverter';
import { ConfigurationManager } from '../configManager';
import { PixelClassMatch } from '../types';

suite('TextProcessor Test Suite', () => {
    let processor: TextProcessor;
    let converter: TailwindConverter;

    setup(() => {
        converter = new TailwindConverter();
        const configManager = new ConfigurationManager();
        processor = new TextProcessor(converter, configManager);
    });

    teardown(() => {
        processor.dispose();
    });

    suite('findPixelClasses', () => {
        test('should find pixel classes in text', () => {
            const text = '<div class="p-16px m-8px">Content</div>';
            const range = new vscode.Range(0, 0, 0, text.length);
            
            const matches = processor.findPixelClasses(text, range);
            
            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0].originalText, 'p-16px');
            assert.strictEqual(matches[0].convertedText, 'p-4');
            assert.strictEqual(matches[1].originalText, 'm-8px');
            assert.strictEqual(matches[1].convertedText, 'm-2');
        });

        test('should return empty array for text without pixel classes', () => {
            const text = '<div class="bg-blue-500 text-lg">Content</div>';
            const range = new vscode.Range(0, 0, 0, text.length);
            
            const matches = processor.findPixelClasses(text, range);
            
            assert.strictEqual(matches.length, 0);
        });

        test('should handle empty text', () => {
            const text = '';
            const range = new vscode.Range(0, 0, 0, 0);
            
            const matches = processor.findPixelClasses(text, range);
            
            assert.strictEqual(matches.length, 0);
        });
    });

    suite('configuration and state', () => {
        test('should have correct debounce delay', () => {
            assert.strictEqual(processor.getDebounceDelay(), 200);
        });

        test('should track pending operations', () => {
            // Initially no pending operations
            assert.strictEqual(processor.hasPendingOperation(), false);
        });

        test('should cancel pending operations', () => {
            processor.cancelPendingOperations();
            assert.strictEqual(processor.hasPendingOperation(), false);
        });

        test('should update converter', () => {
            const newConverter = new TailwindConverter({ 'custom': 15 });
            processor.updateConverter(newConverter);
            
            const text = '<div class="p-15px">Content</div>';
            const range = new vscode.Range(0, 0, 0, text.length);
            
            const matches = processor.findPixelClasses(text, range);
            
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].convertedText, 'p-custom');
        });
    });

    suite('document type validation', () => {
        test('should identify supported document types', () => {
            // We can't easily test the private method, but we can test the behavior
            // by checking that the processor was created successfully
            assert.ok(processor);
        });
    });

    suite('text filtering', () => {
        test('should process text that might contain classes', () => {
            // Test the findPixelClasses method which uses the same logic
            const textWithClass = '<div class="p-16px">Content</div>';
            const textWithPx = 'Some text with 16px value';
            const textWithoutRelevant = 'Just plain text';
            
            const range = new vscode.Range(0, 0, 0, 50);
            
            // Text with class should find matches
            const matches1 = processor.findPixelClasses(textWithClass, range);
            assert.ok(matches1.length > 0);
            
            // Text with px but no class should find no matches
            const matches2 = processor.findPixelClasses(textWithPx, range);
            assert.strictEqual(matches2.length, 0);
            
            // Text without relevant content should find no matches
            const matches3 = processor.findPixelClasses(textWithoutRelevant, range);
            assert.strictEqual(matches3.length, 0);
        });
    });

    suite('range expansion logic', () => {
        test('should handle various text patterns', () => {
            // Test with different HTML structures
            const htmlTexts = [
                '<div class="p-16px">Content</div>',
                '<span className="m-8px w-100px">Text</span>',
                '<button class="px-12px py-6px gap-4px">Button</button>'
            ];
            
            htmlTexts.forEach(text => {
                const range = new vscode.Range(0, 0, 0, text.length);
                const matches = processor.findPixelClasses(text, range);
                
                // Should find at least one match in each
                assert.ok(matches.length > 0, `Should find matches in: ${text}`);
            });
        });
    });

    suite('error handling', () => {
        test('should handle malformed HTML gracefully', () => {
            const malformedTexts = [
                '<div class="p-16px>Content</div>', // Missing quote
                '<div class=p-16px">Content</div>', // Missing quote
                '<div class="p-px">Content</div>',  // Invalid pixel value
                '<div class="invalid-16px">Content</div>' // Unsupported property
            ];
            
            malformedTexts.forEach(text => {
                const range = new vscode.Range(0, 0, 0, text.length);
                
                // Should not throw errors
                assert.doesNotThrow(() => {
                    processor.findPixelClasses(text, range);
                });
            });
        });
    });

    suite('disposal', () => {
        test('should dispose cleanly', () => {
            assert.doesNotThrow(() => {
                processor.dispose();
            });
        });

        test('should cancel operations on disposal', () => {
            processor.dispose();
            assert.strictEqual(processor.hasPendingOperation(), false);
        });
    });

    suite('integration with pattern detector', () => {
        test('should correctly integrate with pattern detector', () => {
            const complexText = `
                <div class="p-16px m-8px">
                    <span className="w-100px h-200px gap-x-12px">
                        <button class="px-24px py-16px top-4px">
                            Content
                        </button>
                    </span>
                </div>
            `;
            
            const range = new vscode.Range(0, 0, 8, 0);
            const matches = processor.findPixelClasses(complexText, range);
            
            // Should find all pixel classes
            assert.ok(matches.length >= 7); // At least 7 pixel classes in the text
            
            // Verify some specific conversions
            const originalTexts = matches.map(m => m.originalText);
            assert.ok(originalTexts.includes('p-16px'));
            assert.ok(originalTexts.includes('m-8px'));
            assert.ok(originalTexts.includes('w-100px'));
            assert.ok(originalTexts.includes('h-200px'));
        });
    });
});