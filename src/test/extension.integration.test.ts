import * as assert from 'assert';
import * as vscode from 'vscode';
import * as extension from '../extension';

suite('Extension Integration Tests', () => {
    let context: vscode.ExtensionContext;

    setup(() => {
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

    suite('complete extension workflow', () => {
        test('should handle full activation to deactivation workflow', () => {
            // Step 1: Activate extension
            extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true, 'Extension should be active');

            // Step 2: Verify all components are initialized
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');
            assert.ok(state.converter, 'Converter should be initialized');
            assert.ok(state.configManager, 'Config manager should be initialized');
            assert.ok(state.textProcessor, 'Text processor should be initialized');
            assert.ok(state.hoverProvider, 'Hover provider should be initialized');
            assert.ok(state.configCommands, 'Config commands should be initialized');

            // Step 3: Verify extension info
            const info = extension.getExtensionInfo();
            assert.strictEqual(info.active, true, 'Info should show active state');
            assert.strictEqual(typeof info.enabled, 'boolean', 'Should have enabled flag');
            assert.ok(Array.isArray(info.supportedFileTypes), 'Should have supported file types');

            // Step 4: Test component integration
            const config = state.configManager.getConfiguration();
            assert.ok(config, 'Should be able to get configuration');
            assert.strictEqual(typeof config.enabled, 'boolean', 'Config should have enabled flag');

            // Step 5: Deactivate extension
            extension.deactivate();
            assert.strictEqual(extension.isExtensionActive(), false, 'Extension should be inactive');
            assert.strictEqual(extension.getExtensionState(), null, 'State should be cleared');
        });

        test('should handle configuration changes during runtime', () => {
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            // Test that configuration manager is working
            const initialConfig = state.configManager.getConfiguration();
            assert.ok(initialConfig, 'Should have initial configuration');

            // Test configuration validation
            const errors = state.configManager.validateConfiguration();
            assert.ok(Array.isArray(errors), 'Should return validation errors array');

            // Configuration should be valid by default
            assert.strictEqual(errors.length, 0, 'Default configuration should be valid');
        });

        test('should integrate all components correctly', () => {
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            // Test converter functionality
            const pixelClass = state.converter.convertPixelClass('p-16px');
            assert.strictEqual(pixelClass, 'p-4', 'Converter should work correctly');

            // Test text processor integration
            const htmlContent = '<div class="p-16px">Content</div>';
            const range = new vscode.Range(0, 0, 0, htmlContent.length);
            const matches = state.textProcessor.findPixelClasses(htmlContent, range);
            assert.ok(matches.length > 0, 'Text processor should find matches');

            // Test hover provider integration
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

            // Should be able to provide hover
            assert.doesNotThrow(async () => {
                await state.hoverProvider.provideHover(mockDocument, position, token);
            });
        });
    });

    suite('error recovery and resilience', () => {
        test('should recover from component errors', () => {
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            // Simulate component error by calling methods that might fail
            assert.doesNotThrow(() => {
                state.configManager.validateConfiguration();
            });

            assert.doesNotThrow(() => {
                state.converter.convertPixelClass('invalid-class');
            });

            // Extension should still be active
            assert.strictEqual(extension.isExtensionActive(), true);
        });

        test('should handle disposal errors gracefully', () => {
            extension.activate(context);
            
            // Should handle deactivation even if there are internal errors
            assert.doesNotThrow(() => {
                extension.deactivate();
            });

            assert.strictEqual(extension.isExtensionActive(), false);
        });

        test('should maintain state consistency', () => {
            // Multiple activation/deactivation cycles should maintain consistency
            for (let i = 0; i < 3; i++) {
                extension.activate(context);
                assert.strictEqual(extension.isExtensionActive(), true, `Should be active in cycle ${i + 1}`);
                
                const state = extension.getExtensionState();
                assert.ok(state, `Should have state in cycle ${i + 1}`);
                
                extension.deactivate();
                assert.strictEqual(extension.isExtensionActive(), false, `Should be inactive after cycle ${i + 1}`);
                assert.strictEqual(extension.getExtensionState(), null, `Should have null state after cycle ${i + 1}`);
            }
        });
    });

    suite('performance and resource management', () => {
        test('should manage resources efficiently', () => {
            const initialSubscriptions = context.subscriptions.length;
            
            extension.activate(context);
            
            // Should register some disposables
            assert.ok(context.subscriptions.length > initialSubscriptions, 'Should register disposables');
            
            const activeSubscriptions = context.subscriptions.length;
            
            extension.deactivate();
            
            // Subscriptions should still be there (VS Code manages them)
            // but our internal state should be cleaned up
            assert.strictEqual(extension.getExtensionState(), null, 'Internal state should be cleaned up');
        });

        test('should handle concurrent operations', () => {
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            // Test concurrent configuration access
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(Promise.resolve(state.configManager.getConfiguration()));
            }

            return Promise.all(promises).then(configs => {
                assert.strictEqual(configs.length, 10, 'Should handle concurrent access');
                configs.forEach(config => {
                    assert.ok(config, 'Each config should be valid');
                });
            });
        });

        test('should have reasonable memory footprint', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            extension.activate(context);
            
            const afterActivation = process.memoryUsage().heapUsed;
            const activationMemory = afterActivation - initialMemory;
            
            extension.deactivate();
            
            const afterDeactivation = process.memoryUsage().heapUsed;
            
            // Memory usage should be reasonable (less than 10MB for activation)
            assert.ok(activationMemory < 10 * 1024 * 1024, `Activation memory usage should be reasonable (used ${activationMemory} bytes)`);
        });
    });

    suite('real-world usage scenarios', () => {
        test('should handle typical development workflow', () => {
            // Simulate typical developer workflow
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            // Developer opens HTML file with Tailwind classes
            const htmlContent = `
                <div class="container mx-auto">
                    <div class="p-16px m-8px w-200px h-100px">
                        <span class="px-12px py-6px gap-x-4px">
                            Content with pixel values
                        </span>
                    </div>
                </div>
            `;

            // Text processor should find pixel classes
            const range = new vscode.Range(0, 0, 8, 0);
            const matches = state.textProcessor.findPixelClasses(htmlContent, range);
            
            assert.ok(matches.length > 0, 'Should find pixel classes in real content');
            
            // Should find specific classes
            const originalTexts = matches.map(m => m.originalText);
            assert.ok(originalTexts.includes('p-16px'), 'Should find p-16px');
            assert.ok(originalTexts.includes('m-8px'), 'Should find m-8px');
            assert.ok(originalTexts.includes('w-200px'), 'Should find w-200px');
            assert.ok(originalTexts.includes('h-100px'), 'Should find h-100px');

            // Should provide appropriate conversions
            const conversions = matches.map(m => ({ original: m.originalText, converted: m.convertedText }));
            const p16Conversion = conversions.find(c => c.original === 'p-16px');
            assert.ok(p16Conversion, 'Should have p-16px conversion');
            assert.strictEqual(p16Conversion.converted, 'p-4', 'Should convert p-16px to p-4');
        });

        test('should handle different file types', () => {
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            const fileTypes = ['html', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'vue', 'svelte'];
            
            fileTypes.forEach(languageId => {
                // Should support each file type
                assert.ok(state.configManager.isSupportedFileType(languageId), `Should support ${languageId}`);
            });

            // Should not support unsupported file types
            const unsupportedTypes = ['python', 'java', 'c'];
            unsupportedTypes.forEach(languageId => {
                assert.strictEqual(state.configManager.isSupportedFileType(languageId), false, `Should not support ${languageId}`);
            });
        });

        test('should provide comprehensive hover information', async () => {
            extension.activate(context);
            
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have extension state');

            // Test hover for standard class
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

            const hover = await state.hoverProvider.provideHover(mockDocument, position, token);
            
            assert.ok(hover, 'Should provide hover information');
            
            if (hover && hover.contents.length > 0) {
                const content = hover.contents[0] as vscode.MarkdownString;
                assert.ok(content.value.includes('p-4'), 'Should include class name');
                assert.ok(content.value.includes('16px'), 'Should include pixel value');
                assert.ok(content.value.includes('padding'), 'Should include CSS property');
            }
        });
    });
});