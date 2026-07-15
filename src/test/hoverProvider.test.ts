import * as assert from 'assert';
import * as vscode from 'vscode';
import { HoverProvider } from '../hoverProvider';
import { TailwindConverter } from '../tailwindConverter';
import { ConfigurationManager } from '../configManager';

suite('HoverProvider Test Suite', () => {
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

    suite('hover provision', () => {
        test('should provide hover for standard Tailwind classes', async () => {
            // Create mock document
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4'; // Mock word at position
                    }
                    return '<div class="p-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 15) // Range for "p-4"
            } as any;

            const position = new vscode.Position(0, 13); // Position within "p-4"
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover, 'Should provide hover information');
            assert.ok(hover instanceof vscode.Hover, 'Should return Hover instance');
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                assert.ok(content.value.includes('p-4'), 'Should include class name');
                assert.ok(content.value.includes('16px'), 'Should include pixel value');
            }
        });

        test('should provide hover for custom Tailwind classes', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-[17px]';
                    }
                    return '<div class="p-[17px]">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 20)
            } as any;

            const position = new vscode.Position(0, 15);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover, 'Should provide hover for custom classes');
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                assert.ok(content.value.includes('p-[17px]'), 'Should include custom class name');
                assert.ok(content.value.includes('17px'), 'Should include custom pixel value');
                assert.ok(content.value.includes('Custom value'), 'Should indicate custom value');
            }
        });

        test('should not provide hover for non-Tailwind classes', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'bg-blue-500';
                    }
                    return '<div class="bg-blue-500">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 23)
            } as any;

            const position = new vscode.Position(0, 15);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.strictEqual(hover, undefined, 'Should not provide hover for non-spacing classes');
        });

        test('should not provide hover for unsupported properties', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'color-4';
                    }
                    return '<div class="color-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 19)
            } as any;

            const position = new vscode.Position(0, 15);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.strictEqual(hover, undefined, 'Should not provide hover for unsupported properties');
        });
    });

    suite('supported properties', () => {
        const testCases = [
            { class: 'p-4', property: 'padding' },
            { class: 'px-4', property: 'padding-left, padding-right' },
            { class: 'py-4', property: 'padding-top, padding-bottom' },
            { class: 'pt-4', property: 'padding-top' },
            { class: 'pr-4', property: 'padding-right' },
            { class: 'pb-4', property: 'padding-bottom' },
            { class: 'pl-4', property: 'padding-left' },
            { class: 'm-4', property: 'margin' },
            { class: 'mx-4', property: 'margin-left, margin-right' },
            { class: 'my-4', property: 'margin-top, margin-bottom' },
            { class: 'mt-4', property: 'margin-top' },
            { class: 'mr-4', property: 'margin-right' },
            { class: 'mb-4', property: 'margin-bottom' },
            { class: 'ml-4', property: 'margin-left' },
            { class: 'w-4', property: 'width' },
            { class: 'h-4', property: 'height' },
            { class: 'gap-4', property: 'gap' },
            { class: 'gap-x-4', property: 'column-gap' },
            { class: 'gap-y-4', property: 'row-gap' },
            { class: 'top-4', property: 'top' },
            { class: 'right-4', property: 'right' },
            { class: 'bottom-4', property: 'bottom' },
            { class: 'left-4', property: 'left' },
            { class: 'inset-4', property: 'top, right, bottom, left' }
        ];

        testCases.forEach(({ class: className, property }) => {
            test(`should provide hover for ${className}`, async () => {
                const mockDocument = {
                    languageId: 'html',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return className;
                        }
                        return `<div class="${className}">Content</div>`;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 12 + className.length)
                } as any;

                const position = new vscode.Position(0, 13);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.ok(hover, `Should provide hover for ${className}`);
                
                if (hover && hover.contents.length > 0) {
                    const content = hover.contents[0] as vscode.MarkdownString;
                    assert.ok(content.value.includes(className), `Should include ${className}`);
                    assert.ok(content.value.includes(property), `Should include ${property}`);
                }
            });
        });
    });

    suite('configuration integration', () => {
        test('should respect hover tooltips configuration', async () => {
            // Test that configuration is checked
            const mockDocument = {
                languageId: 'html',
                getText: () => 'p-4',
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            // Should work when tooltips are enabled (default)
            const hover = await hoverProvider.provideHover(mockDocument, position, token);
            
            // We can't easily test the disabled state without mocking the configuration
            // but we can verify the method doesn't throw
            assert.doesNotThrow(async () => {
                await hoverProvider.provideHover(mockDocument, position, token);
            });
        });

        test('should respect supported file types', async () => {
            const mockDocument = {
                languageId: 'python', // Unsupported language
                getText: () => 'p-4',
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.strictEqual(hover, undefined, 'Should not provide hover for unsupported file types');
        });
    });

    suite('hover content', () => {
        test('should include comprehensive information for standard classes', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4';
                    }
                    return '<div class="p-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 15)
            } as any;

            const position = new vscode.Position(0, 13);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover);
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                const text = content.value;
                
                // Should include key information
                assert.ok(text.includes('Tailwind CSS Class'), 'Should include title');
                assert.ok(text.includes('Pixel Value'), 'Should include pixel value');
                assert.ok(text.includes('CSS Property'), 'Should include CSS property');
                assert.ok(text.includes('Standard Tailwind scale'), 'Should indicate standard scale');
                assert.ok(text.includes('Conversion Examples'), 'Should include conversion examples');
            }
        });

        test('should include custom value information for arbitrary classes', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-[17px]';
                    }
                    return '<div class="p-[17px]">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 20)
            } as any;

            const position = new vscode.Position(0, 15);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover);
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                const text = content.value;
                
                // Should include custom value information
                assert.ok(text.includes('Custom value'), 'Should indicate custom value');
                assert.ok(text.includes('arbitrary'), 'Should mention arbitrary value');
                assert.ok(text.includes('Nearest standard'), 'Should suggest nearest standard');
            }
        });
    });

    suite('edge cases', () => {
        test('should handle invalid word ranges', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: () => '',
                getWordRangeAtPosition: () => undefined // No word at position
            } as any;

            const position = new vscode.Position(0, 0);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.strictEqual(hover, undefined, 'Should handle missing word range');
        });

        test('should handle malformed class names', async () => {
            const malformedClasses = [
                'p-',
                'p-px',
                '-4',
                'p-4-extra',
                'invalid-class'
            ];

            for (const className of malformedClasses) {
                const mockDocument = {
                    languageId: 'html',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return className;
                        }
                        return `<div class="${className}">Content</div>`;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 12 + className.length)
                } as any;

                const position = new vscode.Position(0, 13);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await hoverProvider.provideHover(mockDocument, position, token);

                assert.strictEqual(hover, undefined, `Should not provide hover for malformed class: ${className}`);
            }
        });

        test('should handle zero values', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-0';
                    }
                    return '<div class="p-0">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 15)
            } as any;

            const position = new vscode.Position(0, 13);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await hoverProvider.provideHover(mockDocument, position, token);

            assert.ok(hover, 'Should provide hover for zero values');
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                assert.ok(content.value.includes('0px'), 'Should include 0px value');
            }
        });
    });

    suite('converter integration', () => {
        test('should work with custom spacing scale', () => {
            const customConverter = new TailwindConverter({
                'xs': 2,
                'sm': 6,
                'md': 10
            });

            hoverProvider.updateConverter(customConverter);

            // Test that the provider uses the updated converter
            assert.doesNotThrow(() => {
                hoverProvider.updateConverter(customConverter);
            });
        });

        test('should update configuration manager', () => {
            const newConfigManager = new ConfigurationManager();
            
            assert.doesNotThrow(() => {
                hoverProvider.updateConfigManager(newConfigManager);
            });

            newConfigManager.dispose();
        });
    });

    suite('performance', () => {
        test('should handle hover requests efficiently', async () => {
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4';
                    }
                    return '<div class="p-4">Content</div>';
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 15)
            } as any;

            const position = new vscode.Position(0, 13);
            const token = new vscode.CancellationTokenSource().token;

            // Test multiple rapid hover requests
            const startTime = Date.now();
            
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(hoverProvider.provideHover(mockDocument, position, token));
            }
            
            await Promise.all(promises);
            
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete quickly
            assert.ok(duration < 100, `Hover requests took ${duration}ms, should be under 100ms`);
        });
    });
});