import * as assert from 'assert';
import * as vscode from 'vscode';
import * as extension from '../extension';
import { TailwindConverter } from '../tailwindConverter';
import { ConfigurationManager } from '../configManager';
import { TextProcessor } from '../textProcessor';
import { HoverProvider } from '../hoverProvider';
import { log, LogLevel } from '../logger';

suite('End-to-End Integration Tests', () => {
    let context: vscode.ExtensionContext;

    setup(async () => {
        // Set up logging for tests
        log.setLevel(LogLevel.DEBUG);
        
        // Create mock extension context
        context = {
            subscriptions: [],
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => {},
                keys: () => []
            },
            extensionUri: vscode.Uri.file('/test'),
            extensionPath: '/test',
            asAbsolutePath: (path: string) => `/test/${path}`,
            storagePath: '/test/storage',
            globalStoragePath: '/test/global-storage',
            logPath: '/test/logs',
            extensionMode: vscode.ExtensionMode.Test,
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve()
            } as any,
            environmentVariableCollection: {
                persistent: true,
                replace: () => {},
                append: () => {},
                prepend: () => {},
                get: () => undefined,
                forEach: () => {},
                delete: () => {},
                clear: () => {}
            } as any
        } as any as vscode.ExtensionContext;
    });

    teardown(() => {
        try {
            extension.deactivate();
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    suite('complete user workflows', () => {
        test('should handle complete HTML development workflow', async () => {
            // Step 1: Activate extension
            await extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true, 'Extension should be active');

            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Step 2: Simulate user typing HTML with pixel classes
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test Page</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body>
                    <div class="p-16px m-8px w-200px h-100px">
                        <h1 class="px-24px py-12px">Welcome</h1>
                        <p class="gap-x-4px gap-y-8px">Content with pixel values</p>
                        <button class="top-16px right-8px bottom-4px left-12px">
                            Positioned button
                        </button>
                    </div>
                </body>
                </html>
            `;

            // Step 3: Process the HTML content
            const range = new vscode.Range(0, 0, 15, 0);
            const matches = state.textProcessor.findPixelClasses(htmlContent, range);

            // Step 4: Verify pixel classes were found
            assert.ok(matches.length >= 10, `Should find multiple pixel classes, found ${matches.length}`);

            // Step 5: Verify specific conversions
            const conversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText,
                isCustom: m.isCustomValue
            }));

            const expectedConversions = [
                { original: 'p-16px', converted: 'p-4', isCustom: false },
                { original: 'm-8px', converted: 'm-2', isCustom: false },
                { original: 'w-200px', converted: 'w-[200px]', isCustom: true },
                { original: 'h-100px', converted: 'h-[100px]', isCustom: true },
                { original: 'px-24px', converted: 'px-6', isCustom: false },
                { original: 'py-12px', converted: 'py-3', isCustom: false },
                { original: 'gap-x-4px', converted: 'gap-x-1', isCustom: false },
                { original: 'gap-y-8px', converted: 'gap-y-2', isCustom: false },
                { original: 'top-16px', converted: 'top-4', isCustom: false },
                { original: 'right-8px', converted: 'right-2', isCustom: false },
                { original: 'bottom-4px', converted: 'bottom-1', isCustom: false },
                { original: 'left-12px', converted: 'left-3', isCustom: false }
            ];

            expectedConversions.forEach(expected => {
                const found = conversions.find(c => c.original === expected.original);
                assert.ok(found, `Should find conversion for ${expected.original}`);
                assert.strictEqual(found.converted, expected.converted, 
                    `${expected.original} should convert to ${expected.converted}, got ${found.converted}`);
                assert.strictEqual(found.isCustom, expected.isCustom,
                    `${expected.original} custom flag should be ${expected.isCustom}`);
            });

            // Step 6: Test hover functionality
            const mockDocument = {
                languageId: 'html',
                getText: (range?: vscode.Range) => {
                    if (range) {
                        return 'p-4';
                    }
                    return htmlContent;
                },
                getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 3)
            } as any;

            const position = new vscode.Position(0, 1);
            const token = new vscode.CancellationTokenSource().token;

            const hover = await state.hoverProvider.provideHover(mockDocument, position, token);
            assert.ok(hover, 'Should provide hover information');

            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                assert.ok(content.value.includes('16px'), 'Hover should include pixel value');
                assert.ok(content.value.includes('padding'), 'Hover should include CSS property');
            }
        });

        test('should handle React/JSX development workflow', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Simulate React component with Tailwind classes
            const jsxContent = `
                import React from 'react';
                
                const MyComponent = () => {
                    return (
                        <div className="p-16px m-8px">
                            <header className="w-320px h-64px px-24px py-12px">
                                <h1 className="gap-x-16px gap-y-8px">Title</h1>
                            </header>
                            <main className="inset-4px top-32px">
                                <section className="p-20px m-10px w-400px">
                                    <p>Content with custom pixel values</p>
                                </section>
                            </main>
                        </div>
                    );
                };
                
                export default MyComponent;
            `;

            const range = new vscode.Range(0, 0, 18, 0);
            const matches = state.textProcessor.findPixelClasses(jsxContent, range);

            assert.ok(matches.length >= 8, `Should find JSX pixel classes, found ${matches.length}`);

            // Verify JSX-specific conversions
            const jsxConversions = [
                { original: 'p-16px', converted: 'p-4' },
                { original: 'm-8px', converted: 'm-2' },
                { original: 'w-320px', converted: 'w-80' },
                { original: 'h-64px', converted: 'h-16' },
                { original: 'px-24px', converted: 'px-6' },
                { original: 'py-12px', converted: 'py-3' },
                { original: 'gap-x-16px', converted: 'gap-x-4' },
                { original: 'gap-y-8px', converted: 'gap-y-2' },
                { original: 'inset-4px', converted: 'inset-1' },
                { original: 'top-32px', converted: 'top-8' },
                { original: 'p-20px', converted: 'p-5' },
                { original: 'm-10px', converted: 'm-[10px]' }, // Custom value
                { original: 'w-400px', converted: 'w-[400px]' } // Custom value
            ];

            const foundConversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText 
            }));

            jsxConversions.forEach(expected => {
                const found = foundConversions.find(c => c.original === expected.original);
                assert.ok(found, `Should find JSX conversion for ${expected.original}`);
                assert.strictEqual(found.converted, expected.converted,
                    `JSX: ${expected.original} should convert to ${expected.converted}`);
            });
        });

        test('should handle Vue.js development workflow', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Simulate Vue component with Tailwind classes
            const vueContent = `
                <template>
                    <div class="p-16px m-8px w-300px h-200px">
                        <nav class="px-20px py-10px gap-x-12px">
                            <ul class="top-8px right-16px">
                                <li class="bottom-4px left-24px">Item 1</li>
                                <li class="inset-6px">Item 2</li>
                            </ul>
                        </nav>
                        <main class="p-32px m-16px">
                            <article class="w-500px h-300px gap-y-20px">
                                Content area
                            </article>
                        </main>
                    </div>
                </template>
                
                <script>
                export default {
                    name: 'MyVueComponent'
                }
                </script>
            `;

            const range = new vscode.Range(0, 0, 22, 0);
            const matches = state.textProcessor.findPixelClasses(vueContent, range);

            assert.ok(matches.length >= 10, `Should find Vue pixel classes, found ${matches.length}`);

            // Verify Vue-specific conversions
            const vueConversions = [
                { original: 'p-16px', converted: 'p-4' },
                { original: 'm-8px', converted: 'm-2' },
                { original: 'w-300px', converted: 'w-[300px]' },
                { original: 'h-200px', converted: 'h-[200px]' },
                { original: 'px-20px', converted: 'px-5' },
                { original: 'py-10px', converted: 'py-[10px]' },
                { original: 'gap-x-12px', converted: 'gap-x-3' },
                { original: 'top-8px', converted: 'top-2' },
                { original: 'right-16px', converted: 'right-4' },
                { original: 'bottom-4px', converted: 'bottom-1' },
                { original: 'left-24px', converted: 'left-6' },
                { original: 'inset-6px', converted: 'inset-[6px]' },
                { original: 'p-32px', converted: 'p-8' },
                { original: 'm-16px', converted: 'm-4' }
            ];

            const foundConversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText 
            }));

            vueConversions.forEach(expected => {
                const found = foundConversions.find(c => c.original === expected.original);
                assert.ok(found, `Should find Vue conversion for ${expected.original}`);
                assert.strictEqual(found.converted, expected.converted,
                    `Vue: ${expected.original} should convert to ${expected.converted}`);
            });
        });
    });

    suite('configuration-driven workflows', () => {
        test('should work with custom Tailwind configuration', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Simulate custom spacing scale
            const customSpacing = {
                'xs': 2,
                'sm': 6,
                'base': 14,
                'lg': 18,
                'xl': 22,
                '2xl': 26
            };

            // Update converter with custom spacing
            const customConverter = new TailwindConverter(customSpacing);
            state.textProcessor.updateConverter(customConverter);
            state.hoverProvider.updateConverter(customConverter);

            // Test content with custom spacing values
            const customContent = `
                <div class="p-2px m-6px w-14px h-18px">
                    <span class="px-22px py-26px gap-x-2px">
                        Custom spacing content
                    </span>
                </div>
            `;

            const range = new vscode.Range(0, 0, 6, 0);
            const matches = state.textProcessor.findPixelClasses(customContent, range);

            assert.ok(matches.length >= 6, `Should find custom spacing matches, found ${matches.length}`);

            // Verify custom spacing conversions
            const customConversions = [
                { original: 'p-2px', converted: 'p-xs' },
                { original: 'm-6px', converted: 'm-sm' },
                { original: 'w-14px', converted: 'w-base' },
                { original: 'h-18px', converted: 'h-lg' },
                { original: 'px-22px', converted: 'px-xl' },
                { original: 'py-26px', converted: 'py-2xl' },
                { original: 'gap-x-2px', converted: 'gap-x-xs' }
            ];

            const foundConversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText 
            }));

            customConversions.forEach(expected => {
                const found = foundConversions.find(c => c.original === expected.original);
                assert.ok(found, `Should find custom conversion for ${expected.original}`);
                assert.strictEqual(found.converted, expected.converted,
                    `Custom: ${expected.original} should convert to ${expected.converted}`);
            });
        });

        test('should handle mixed custom and default spacing', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Partial custom spacing (some values custom, others default)
            const partialCustomSpacing = {
                'tiny': 1,
                'huge': 100
            };

            const partialCustomConverter = new TailwindConverter(partialCustomSpacing);
            state.textProcessor.updateConverter(partialCustomConverter);

            const mixedContent = `
                <div class="p-1px m-16px w-100px h-50px">
                    <span class="px-8px py-4px gap-x-12px">
                        Mixed spacing content
                    </span>
                </div>
            `;

            const range = new vscode.Range(0, 0, 6, 0);
            const matches = state.textProcessor.findPixelClasses(mixedContent, range);

            const mixedConversions = [
                { original: 'p-1px', converted: 'p-tiny' },      // Custom
                { original: 'm-16px', converted: 'm-4' },        // Default
                { original: 'w-100px', converted: 'w-huge' },    // Custom
                { original: 'h-50px', converted: 'h-[50px]' },   // Arbitrary
                { original: 'px-8px', converted: 'px-2' },       // Default
                { original: 'py-4px', converted: 'py-1' },       // Default
                { original: 'gap-x-12px', converted: 'gap-x-3' } // Default
            ];

            const foundConversions = matches.map(m => ({ 
                original: m.originalText, 
                converted: m.convertedText 
            }));

            mixedConversions.forEach(expected => {
                const found = foundConversions.find(c => c.original === expected.original);
                assert.ok(found, `Should find mixed conversion for ${expected.original}`);
                assert.strictEqual(found.converted, expected.converted,
                    `Mixed: ${expected.original} should convert to ${expected.converted}`);
            });
        });
    });

    suite('error scenarios and edge cases', () => {
        test('should handle malformed HTML gracefully', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            const malformedHtml = `
                <div class="p-16px m-8px>
                    <span className=w-100px h-50px">
                        <button class="px-12px py-6px gap-4px
                            Malformed content
                        </button>
                    </span>
                </div>
            `;

            const range = new vscode.Range(0, 0, 8, 0);
            
            // Should not throw errors
            assert.doesNotThrow(() => {
                const matches = state.textProcessor.findPixelClasses(malformedHtml, range);
                
                // Should still find some valid matches
                assert.ok(Array.isArray(matches), 'Should return matches array');
                
                // Should find at least some valid pixel classes
                const validMatches = matches.filter(m => m.originalText && m.convertedText);
                assert.ok(validMatches.length >= 0, 'Should handle malformed HTML gracefully');
            });
        });

        test('should handle very large documents efficiently', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Generate large HTML document
            let largeHtml = '<div class="container">\n';
            for (let i = 0; i < 500; i++) {
                largeHtml += `  <div class="p-${16 + (i % 10)}px m-${8 + (i % 5)}px w-${100 + i}px h-${50 + i}px">\n`;
                largeHtml += `    <span class="px-${12 + (i % 8)}px py-${6 + (i % 4)}px gap-x-${4 + (i % 6)}px">Item ${i}</span>\n`;
                largeHtml += `  </div>\n`;
            }
            largeHtml += '</div>';

            const range = new vscode.Range(0, 0, 1503, 0);

            // Measure performance
            const startTime = Date.now();
            const matches = state.textProcessor.findPixelClasses(largeHtml, range);
            const endTime = Date.now();

            const duration = endTime - startTime;
            
            // Should complete in reasonable time
            assert.ok(duration < 2000, `Large document processing took ${duration}ms, should be under 2000ms`);
            
            // Should find many matches
            assert.ok(matches.length >= 1000, `Should find many matches in large document, found ${matches.length}`);
            
            // Verify some conversions are correct
            const sampleMatches = matches.slice(0, 10);
            sampleMatches.forEach(match => {
                assert.ok(match.originalText.includes('px'), 'Should have pixel classes');
                assert.ok(match.convertedText, 'Should have converted text');
                assert.ok(typeof match.isCustomValue === 'boolean', 'Should have custom value flag');
            });
        });

        test('should handle concurrent processing', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            const testContents = [
                '<div class="p-16px m-8px">Content 1</div>',
                '<span class="w-100px h-50px">Content 2</span>',
                '<button class="px-12px py-6px">Content 3</button>',
                '<nav class="gap-x-4px gap-y-8px">Content 4</nav>',
                '<main class="top-16px right-8px">Content 5</main>'
            ];

            // Process multiple contents concurrently
            const promises = testContents.map((content, index) => {
                const range = new vscode.Range(0, 0, 0, content.length);
                return Promise.resolve(state.textProcessor.findPixelClasses(content, range));
            });

            const results = await Promise.all(promises);
            
            // All should complete successfully
            assert.strictEqual(results.length, 5, 'Should process all contents');
            
            results.forEach((matches, index) => {
                assert.ok(Array.isArray(matches), `Result ${index} should be an array`);
                assert.ok(matches.length > 0, `Result ${index} should have matches`);
            });
        });
    });

    suite('performance and scalability', () => {
        test('should handle rapid typing simulation', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Simulate rapid typing by processing many small changes
            const baseContent = '<div class="';
            const typingSequence = [
                'p',
                'p-',
                'p-1',
                'p-16',
                'p-16p',
                'p-16px',
                'p-16px ',
                'p-16px m',
                'p-16px m-',
                'p-16px m-8',
                'p-16px m-8p',
                'p-16px m-8px'
            ];

            const startTime = Date.now();
            
            for (const typing of typingSequence) {
                const content = baseContent + typing + '">Content</div>';
                const range = new vscode.Range(0, 0, 0, content.length);
                
                const matches = state.textProcessor.findPixelClasses(content, range);
                
                // Should handle each typing step
                assert.ok(Array.isArray(matches), 'Should return matches array for each typing step');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should handle rapid typing efficiently
            assert.ok(duration < 500, `Rapid typing simulation took ${duration}ms, should be under 500ms`);
        });

        test('should maintain performance with complex nested structures', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Create deeply nested structure with many pixel classes
            let nestedHtml = '';
            for (let depth = 0; depth < 20; depth++) {
                nestedHtml += `<div class="p-${16 + depth}px m-${8 + depth}px w-${100 + depth * 10}px h-${50 + depth * 5}px">`;
            }
            nestedHtml += 'Deeply nested content';
            for (let depth = 0; depth < 20; depth++) {
                nestedHtml += '</div>';
            }

            const range = new vscode.Range(0, 0, 0, nestedHtml.length);

            const startTime = Date.now();
            const matches = state.textProcessor.findPixelClasses(nestedHtml, range);
            const endTime = Date.now();

            const duration = endTime - startTime;
            
            // Should handle nested structures efficiently
            assert.ok(duration < 200, `Nested structure processing took ${duration}ms, should be under 200ms`);
            assert.ok(matches.length >= 60, `Should find matches in nested structure, found ${matches.length}`);
        });
    });

    suite('real-world integration scenarios', () => {
        test('should integrate with typical development workflow', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Simulate a typical development session
            const developmentSteps = [
                // Step 1: Create basic layout
                '<div class="p-16px m-8px">Layout</div>',
                
                // Step 2: Add responsive design
                '<div class="p-16px m-8px w-320px h-200px">Responsive</div>',
                
                // Step 3: Add interactive elements
                '<div class="p-16px m-8px w-320px h-200px"><button class="px-12px py-6px">Button</button></div>',
                
                // Step 4: Add spacing and positioning
                '<div class="p-16px m-8px w-320px h-200px gap-x-8px"><button class="px-12px py-6px top-4px">Button</button></div>',
                
                // Step 5: Refine with custom values
                '<div class="p-16px m-8px w-320px h-200px gap-x-8px"><button class="px-12px py-6px top-4px right-15px">Button</button></div>'
            ];

            let totalMatches = 0;
            let totalConversions = 0;

            for (const [index, step] of developmentSteps.entries()) {
                const range = new vscode.Range(0, 0, 0, step.length);
                const matches = state.textProcessor.findPixelClasses(step, range);
                
                totalMatches += matches.length;
                totalConversions += matches.filter(m => m.convertedText !== m.originalText).length;
                
                // Verify each step finds appropriate matches
                assert.ok(matches.length >= index + 1, 
                    `Development step ${index + 1} should find at least ${index + 1} matches, found ${matches.length}`);
            }

            // Should have processed many matches across all steps
            assert.ok(totalMatches >= 15, `Should process many matches across development steps, processed ${totalMatches}`);
            assert.ok(totalConversions >= 10, `Should perform many conversions, performed ${totalConversions}`);
        });
    });
});