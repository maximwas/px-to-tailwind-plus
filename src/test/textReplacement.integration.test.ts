import * as assert from 'assert';
import * as vscode from 'vscode';
import { TextProcessor } from '../textProcessor';
import { TailwindConverter } from '../tailwindConverter';
import { ReplacementHandler } from '../replacementHandler';
import { ConfigurationManager } from '../configManager';

suite('Text Replacement Integration Tests', () => {
    let processor: TextProcessor;
    let converter: TailwindConverter;
    let handler: ReplacementHandler;

    setup(() => {
        converter = new TailwindConverter();
        const configManager = new ConfigurationManager();
        processor = new TextProcessor(converter, configManager);
        handler = new ReplacementHandler();
    });

    teardown(() => {
        processor.dispose();
    });

    suite('end-to-end replacement workflow', () => {
        test('should handle complete replacement workflow', () => {
            const htmlContent = '<div class="p-16px m-8px w-100px">Content</div>';
            const range = new vscode.Range(0, 0, 0, htmlContent.length);
            
            // Step 1: Find pixel classes
            const matches = processor.findPixelClasses(htmlContent, range);
            
            // Verify matches found
            assert.strictEqual(matches.length, 3);
            
            // Step 2: Get replacement statistics
            const stats = handler.getReplacementStats(matches);
            
            assert.strictEqual(stats.total, 3);
            assert.strictEqual(stats.standard, 2); // p-16px -> p-4, m-8px -> m-2
            assert.strictEqual(stats.custom, 1);   // w-100px -> w-[100px]
            assert.strictEqual(stats.properties.size, 3);
        });

        test('should handle complex HTML structures', () => {
            const complexHtml = `
                <div class="p-16px m-8px">
                    <span className="w-100px h-200px gap-x-12px">
                        <button class="px-24px py-16px top-4px">
                            Content
                        </button>
                    </span>
                </div>
            `;
            
            const range = new vscode.Range(0, 0, 8, 0);
            const matches = processor.findPixelClasses(complexHtml, range);
            
            // Should find all pixel classes
            assert.ok(matches.length >= 7);
            
            // Verify specific conversions
            const conversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText,
                isCustom: m.isCustomValue
            }));
            
            // Check for expected conversions
            const expectedConversions = [
                { original: 'p-16px', converted: 'p-4', isCustom: false },
                { original: 'm-8px', converted: 'm-2', isCustom: false },
                { original: 'w-100px', converted: 'w-[100px]', isCustom: true },
                { original: 'h-200px', converted: 'h-[200px]', isCustom: true },
                { original: 'gap-x-12px', converted: 'gap-x-3', isCustom: false },
                { original: 'px-24px', converted: 'px-6', isCustom: false },
                { original: 'py-16px', converted: 'py-4', isCustom: false },
                { original: 'top-4px', converted: 'top-1', isCustom: false }
            ];
            
            for (const expected of expectedConversions) {
                const found = conversions.find(c => c.original === expected.original);
                assert.ok(found, `Should find conversion for ${expected.original}`);
                assert.strictEqual(found.converted, expected.converted);
                assert.strictEqual(found.isCustom, expected.isCustom);
            }
        });

        test('should handle JSX className attributes', () => {
            const jsxContent = `
                const Component = () => (
                    <div className="p-16px m-8px">
                        <span className="w-100px h-50px gap-y-12px">
                            Text content
                        </span>
                    </div>
                );
            `;
            
            const range = new vscode.Range(0, 0, 7, 0);
            const matches = processor.findPixelClasses(jsxContent, range);
            
            assert.ok(matches.length >= 5);
            
            // Verify JSX-specific matches
            const originalTexts = matches.map(m => m.originalText);
            assert.ok(originalTexts.includes('p-16px'));
            assert.ok(originalTexts.includes('m-8px'));
            assert.ok(originalTexts.includes('w-100px'));
            assert.ok(originalTexts.includes('h-50px'));
            assert.ok(originalTexts.includes('gap-y-12px'));
        });
    });

    suite('error recovery and edge cases', () => {
        test('should handle malformed HTML gracefully', () => {
            const malformedHtml = `
                <div class="p-16px m-8px>
                    <span className=w-100px h-50px">
                        Content
                    </span>
                </div>
            `;
            
            const range = new vscode.Range(0, 0, 6, 0);
            
            // Should not throw errors
            assert.doesNotThrow(() => {
                const matches = processor.findPixelClasses(malformedHtml, range);
                const stats = handler.getReplacementStats(matches);
                
                // Should still find some valid matches
                assert.ok(stats.total >= 0);
            });
        });

        test('should handle empty and whitespace-only content', () => {
            const testCases = [
                '',
                '   ',
                '\n\n\n',
                '<div></div>',
                '<div class=""></div>',
                '<div class="   "></div>'
            ];
            
            testCases.forEach(content => {
                const range = new vscode.Range(0, 0, 0, content.length);
                const matches = processor.findPixelClasses(content, range);
                
                // Should handle gracefully
                assert.ok(Array.isArray(matches));
                assert.strictEqual(matches.length, 0);
            });
        });

        test('should handle mixed valid and invalid pixel classes', () => {
            const mixedContent = `
                <div class="p-16px invalid-px m-8px color-16px w-100px">
                    Content
                </div>
            `;
            
            const range = new vscode.Range(0, 0, 4, 0);
            const matches = processor.findPixelClasses(mixedContent, range);
            
            // Should only find valid pixel classes
            const originalTexts = matches.map(m => m.originalText);
            assert.ok(originalTexts.includes('p-16px'));
            assert.ok(originalTexts.includes('m-8px'));
            assert.ok(originalTexts.includes('w-100px'));
            
            // Should not include invalid ones
            assert.ok(!originalTexts.includes('invalid-px'));
            assert.ok(!originalTexts.includes('color-16px'));
        });
    });

    suite('performance with large content', () => {
        test('should handle large HTML documents efficiently', () => {
            // Generate large HTML content
            let largeHtml = '<div>\n';
            for (let i = 0; i < 100; i++) {
                largeHtml += `  <div class="p-${16 + i}px m-${8 + i}px w-${100 + i}px">Item ${i}</div>\n`;
            }
            largeHtml += '</div>';
            
            const range = new vscode.Range(0, 0, 102, 0);
            
            // Measure performance (should complete quickly)
            const startTime = Date.now();
            const matches = processor.findPixelClasses(largeHtml, range);
            const endTime = Date.now();
            
            // Should find all matches
            assert.strictEqual(matches.length, 300); // 3 matches per line * 100 lines
            
            // Should complete in reasonable time (less than 1 second)
            const duration = endTime - startTime;
            assert.ok(duration < 1000, `Processing took ${duration}ms, should be under 1000ms`);
            
            // Verify statistics
            const stats = handler.getReplacementStats(matches);
            assert.strictEqual(stats.total, 300);
            assert.ok(stats.standard > 0);
            assert.ok(stats.custom > 0);
        });
    });

    suite('custom converter integration', () => {
        test('should work with custom spacing scale', () => {
            const customConverter = new TailwindConverter({
                'xs': 2,
                'sm': 6,
                'md': 10,
                'lg': 14
            });
            
            const customConfigManager = new ConfigurationManager();
            const customProcessor = new TextProcessor(customConverter, customConfigManager);
            
            const content = '<div class="p-2px m-6px w-10px h-14px">Content</div>';
            const range = new vscode.Range(0, 0, 0, content.length);
            
            const matches = customProcessor.findPixelClasses(content, range);
            
            // Should use custom scale
            const conversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText 
            }));
            
            assert.ok(conversions.some(c => c.original === 'p-2px' && c.converted === 'p-xs'));
            assert.ok(conversions.some(c => c.original === 'm-6px' && c.converted === 'm-sm'));
            assert.ok(conversions.some(c => c.original === 'w-10px' && c.converted === 'w-md'));
            assert.ok(conversions.some(c => c.original === 'h-14px' && c.converted === 'h-lg'));
            
            customProcessor.dispose();
        });
    });
});