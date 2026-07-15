import * as assert from 'assert';
import * as vscode from 'vscode';
import { HoverProvider } from '../hoverProvider';
import { TailwindConverter } from '../tailwindConverter';
import { ConfigurationManager } from '../configManager';

suite('HoverProvider Integration Tests', () => {
    let hoverProvider: HoverProvider;
    let converter: TailwindConverter;
    let configManager: ConfigurationManager;

    setup(() => {
        converter = new TailwindConverter();
        configManager = new ConfigurationManager();
        hoverProvider = new HoverProvider(converter, configManager);
    });

    teardown(() => {
        configManager.dispose();
    });

    suite('real-world hover scenarios', () => {
        test('should provide hover in HTML documents', async () => {
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test</title>
                </head>
                <body>
                    <div class="p-4 m-2 w-64 h-32">
                        <span class="px-6 py-3 gap-x-4">Content</span>
                    </div>
                </body>
                </html>
            `;

            const testCases = [
                { className: 'p-4', expectedPixels: 16 },
                { className: 'm-2', expectedPixels: 8 },
                { className: 'w-64', expectedPixels: 256 },
                { className: 'h-32', expectedPixels: 128 },
                { className: 'px-6', expectedPixels: 24 },
                { className: 'py-3', expectedPixels: 12 },
                { className: 'gap-x-4', expectedPixels: 16 }
            ];

            for (const testCase of testCases) {
                const mockDocument = {
                    languageId: 'html',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return testCase.className;
                        }
                        return htmlContent;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, testCase.className.length)
                } as any;

                const position = new vscode.Position(0, 1);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.ok(hover, `Should provide hover for ${testCase.className}`);
                
                if (hover && hover.contents.length > 0) {
                    const content = hover.contents[0] as vscode.MarkdownString;
                    assert.ok(content.value.includes(testCase.className), `Should include ${testCase.className}`);
                    assert.ok(content.value.includes(`${testCase.expectedPixels}px`), `Should include ${testCase.expectedPixels}px`);
                }
            }
        });

        test('should provide hover in JSX/TSX documents', async () => {
            const jsxContent = `
                import React from 'react';
                
                const Component = () => {
                    return (
                        <div className="p-8 m-4 w-96 h-64">
                            <button className="px-4 py-2 gap-2">
                                Click me
                            </button>
                        </div>
                    );
                };
                
                export default Component;
            `;

            const testCases = [
                { className: 'p-8', expectedPixels: 32 },
                { className: 'm-4', expectedPixels: 16 },
                { className: 'w-96', expectedPixels: 384 },
                { className: 'h-64', expectedPixels: 256 },
                { className: 'px-4', expectedPixels: 16 },
                { className: 'py-2', expectedPixels: 8 },
                { className: 'gap-2', expectedPixels: 8 }
            ];

            for (const testCase of testCases) {
                const mockDocument = {
                    languageId: 'javascriptreact',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return testCase.className;
                        }
                        return jsxContent;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, testCase.className.length)
                } as any;

                const position = new vscode.Position(0, 1);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.ok(hover, `Should provide hover for ${testCase.className} in JSX`);
                
                if (hover && hover.contents.length > 0) {
                    const content = hover.contents[0] as vscode.MarkdownString;
                    assert.ok(content.value.includes(`${testCase.expectedPixels}px`), `Should include ${testCase.expectedPixels}px for ${testCase.className}`);
                }
            }
        });

        test('should provide hover for custom values', async () => {
            const customValues = [
                { className: 'p-[17px]', expectedPixels: 17 },
                { className: 'm-[25px]', expectedPixels: 25 },
                { className: 'w-[100px]', expectedPixels: 100 },
                { className: 'h-[75px]', expectedPixels: 75 },
                { className: 'gap-[14px]', expectedPixels: 14 }
            ];

            for (const testCase of customValues) {
                const mockDocument = {
                    languageId: 'html',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return testCase.className;
                        }
                        return `<div class="${testCase.className}">Content</div>`;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, testCase.className.length)
                } as any;

                const position = new vscode.Position(0, 1);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.ok(hover, `Should provide hover for custom value ${testCase.className}`);
                
                if (hover && hover.contents.length > 0) {
                    const content = hover.contents[0] as vscode.MarkdownString;
                    assert.ok(content.value.includes(testCase.className), `Should include ${testCase.className}`);
                    assert.ok(content.value.includes(`${testCase.expectedPixels}px`), `Should include ${testCase.expectedPixels}px`);
                    assert.ok(content.value.includes('Custom value'), 'Should indicate custom value');
                    assert.ok(content.value.includes('Nearest standard'), 'Should suggest nearest standard');
                }
            }
        });
    });

    suite('hover content quality', () => {
        test('should provide comprehensive information', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4';
                    }
                    return '<div class="p-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover);
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                const text = content.value;
                
                // Check for all expected sections
                const expectedSections = [
                    'Tailwind CSS Class',
                    'Pixel Value',
                    'CSS Property',
                    'Type:',
                    'Scale Value',
                    'Conversion Examples',
                    'Related Classes'
                ];

                expectedSections.forEach(section => {
                    assert.ok(text.includes(section), `Should include ${section} section`);
                });

                // Check for specific content
                assert.ok(text.includes('p-4'), 'Should include class name');
                assert.ok(text.includes('16px'), 'Should include pixel value');
                assert.ok(text.includes('padding'), 'Should include CSS property name');
                assert.ok(text.includes('Standard Tailwind scale'), 'Should indicate standard scale');
            }
        });

        test('should provide helpful related classes', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'm-4';
                    }
                    return '<div class="m-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover);
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                const text = content.value;
                
                // Should include negative margin for margin classes
                assert.ok(text.includes('-m-4'), 'Should include negative margin class');
                
                // Should include responsive variants
                assert.ok(text.includes('sm:m-4') || text.includes('md:m-4'), 'Should include responsive variants');
            }
        });

        test('should handle positioning classes correctly', async () => {
            const positioningClasses = ['top-4', 'right-8', 'bottom-2', 'left-6', 'inset-4'];

            for (const className of positioningClasses) {
                const mockDocument = {
                    languageId: 'html',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return className;
                        }
                        return `<div class="${className}">Content</div>`;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, className.length)
                } as any;

                const position = new vscode.Position(0, 1);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.ok(hover, `Should provide hover for ${className}`);
                
                if (hover && hover.contents.length > 0) {
                    const content = hover.contents[0] as vscode.MarkdownString;
                    const text = content.value;
                    
                    assert.ok(text.includes(className), `Should include ${className}`);
                    
                    // Check for appropriate CSS property description
                    if (className.startsWith('top')) {
                        assert.ok(text.includes('top position'), 'Should describe top position');
                    } else if (className.startsWith('right')) {
                        assert.ok(text.includes('right position'), 'Should describe right position');
                    } else if (className.startsWith('bottom')) {
                        assert.ok(text.includes('bottom position'), 'Should describe bottom position');
                    } else if (className.startsWith('left')) {
                        assert.ok(text.includes('left position'), 'Should describe left position');
                    } else if (className.startsWith('inset')) {
                        assert.ok(text.includes('all position properties'), 'Should describe inset');
                    }
                }
            }
        });
    });

    suite('configuration integration', () => {
        test('should work with custom spacing scale', async () => {
            const customConverter = new TailwindConverter({
                'xs': 2,
                'sm': 6,
                'md': 10,
                'lg': 14
            });

            const customHoverProvider = new HoverProvider(customConverter, configManager);

            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-xs';
                    }
                    return '<div class="p-xs">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 4)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await customHoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover, 'Should provide hover for custom scale values');
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                assert.ok(content.value.includes('p-xs'), 'Should include custom class name');
                assert.ok(content.value.includes('2px'), 'Should include custom pixel value');
            }
        });

        test('should respect file type configuration', async () => {
            const supportedTypes = ['html', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue', 'svelte'];
            const unsupportedTypes = ['python', 'java', 'c', 'cpp'];

            for (const languageId of supportedTypes) {
                const mockDocument = {
                    languageId,
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return 'p-4';
                        }
                        return '<div class="p-4">Content</div>';
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
                } as any;

                const position = new vscode.Position(0, 1);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.ok(hover, `Should provide hover for supported language: ${languageId}`);
            }

            for (const languageId of unsupportedTypes) {
                const mockDocument = {
                    languageId,
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return 'p-4';
                        }
                        return 'p-4';
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
                } as any;

                const position = new vscode.Position(0, 1);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.strictEqual(hover, undefined, `Should not provide hover for unsupported language: ${languageId}`);
            }
        });
    });

    suite('performance and reliability', () => {
        test('should handle large documents efficiently', async () => {
            // Create a large HTML document with many Tailwind classes
            let largeContent = '<div>\n';
            for (let i = 0; i < 100; i++) {
                largeContent += `  <div class="p-${i % 12} m-${i % 8} w-${i % 96}">Item ${i}</div>\n`;
            }
            largeContent += '</div>';

            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4';
                    }
                    return largeContent;
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            const startTime = Date.now();
            const hover = await hoverProvider.provideHover(mockDocument, position, token);
            const endTime = Date.now();

            const duration = endTime - startTime;
            assert.ok(duration < 50, `Hover should complete quickly even with large documents (took ${duration}ms)`);
            assert.ok(hover, 'Should still provide hover for large documents');
        });

        test('should handle concurrent hover requests', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4';
                    }
                    return '<div class="p-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            // Make multiple concurrent requests
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(hoverProvider.provideHover(mockDocument, position, token));
            }

            const startTime = Date.now();
            const results = await Promise.all(promises);
            const endTime = Date.now();

            const duration = endTime - startTime;
            assert.ok(duration < 200, `Concurrent hover requests should complete quickly (took ${duration}ms)`);
            
            // All requests should succeed
            results.forEach((result, index) => {
                assert.ok(result, `Request ${index} should succeed`);
            });
        });
    });
});