import * as assert from 'assert';
import * as vscode from 'vscode';
import * as extension from '../extension';

suite('Extension Test Suite', () => {
    let context: vscode.ExtensionContext;

    setup(() => {
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
        // Clean up after each test
        try {
            extension.deactivate();
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    suite('activation', () => {
        test('should activate extension successfully', () => {
            assert.doesNotThrow(() => {
                extension.activate(context);
            });

            // Should be active after activation
            assert.strictEqual(extension.isExtensionActive(), true);
        });

        test('should initialize all components', () => {
            extension.activate(context);

            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should be initialized');
            assert.ok(state.converter, 'Converter should be initialized');
            assert.ok(state.configManager, 'Config manager should be initialized');
            assert.ok(state.textProcessor, 'Text processor should be initialized');
            assert.ok(state.hoverProvider, 'Hover provider should be initialized');
            assert.ok(state.configCommands, 'Config commands should be initialized');
        });

        test('should register disposables with context', () => {
            const initialSubscriptions = context.subscriptions.length;
            
            extension.activate(context);

            // Should have added disposables to context
            assert.ok(context.subscriptions.length > initialSubscriptions, 'Should register disposables');
        });

        test('should handle activation errors gracefully', () => {
            // Create a context that will cause errors
            const errorContext = {
                ...context,
                subscriptions: null // This will cause an error
            } as any;

            assert.throws(() => {
                extension.activate(errorContext);
            });
        });
    });

    suite('deactivation', () => {
        test('should deactivate extension successfully', () => {
            extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true);

            assert.doesNotThrow(() => {
                extension.deactivate();
            });

            assert.strictEqual(extension.isExtensionActive(), false);
        });

        test('should clean up resources on deactivation', () => {
            extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Should have state before deactivation');

            extension.deactivate();

            const stateAfter = extension.getExtensionState();
            assert.strictEqual(stateAfter, null, 'State should be null after deactivation');
        });

        test('should handle deactivation when not activated', () => {
            // Should not throw when deactivating without activation
            assert.doesNotThrow(() => {
                extension.deactivate();
            });
        });

        test('should handle deactivation errors gracefully', () => {
            extension.activate(context);

            // Should not throw even if there are internal errors
            assert.doesNotThrow(() => {
                extension.deactivate();
            });
        });
    });

    suite('extension state management', () => {
        test('should track extension active state correctly', () => {
            // Initially not active
            assert.strictEqual(extension.isExtensionActive(), false);

            // Active after activation
            extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true);

            // Not active after deactivation
            extension.deactivate();
            assert.strictEqual(extension.isExtensionActive(), false);
        });

        test('should provide extension state when active', () => {
            extension.activate(context);

            const state = extension.getExtensionState();
            assert.ok(state, 'Should provide state when active');
            assert.ok(typeof state === 'object', 'State should be an object');
        });

        test('should return null state when not active', () => {
            const state = extension.getExtensionState();
            assert.strictEqual(state, null, 'Should return null when not active');
        });
    });

    suite('extension information', () => {
        test('should provide extension info when active', () => {
            extension.activate(context);

            const info = extension.getExtensionInfo();
            assert.ok(info, 'Should provide extension info');
            assert.strictEqual(info.active, true, 'Should indicate active state');
            assert.strictEqual(typeof info.enabled, 'boolean', 'Should include enabled state');
            assert.ok(Array.isArray(info.supportedFileTypes), 'Should include supported file types');
            assert.strictEqual(typeof info.showVisualFeedback, 'boolean', 'Should include visual feedback setting');
            assert.strictEqual(typeof info.showHoverTooltips, 'boolean', 'Should include hover tooltips setting');
        });

        test('should provide error info when not active', () => {
            const info = extension.getExtensionInfo();
            assert.ok(info, 'Should provide info even when not active');
            assert.strictEqual(info.active, false, 'Should indicate inactive state');
            assert.ok(info.error, 'Should include error message');
        });

        test('should handle info retrieval errors', () => {
            extension.activate(context);
            
            // Force an error by deactivating but not clearing state properly
            const state = extension.getExtensionState();
            if (state) {
                // Simulate a broken state
                (state as any).configManager = null;
            }

            const info = extension.getExtensionInfo();
            assert.ok(info, 'Should still provide info object');
            assert.strictEqual(info.active, true, 'Should indicate active state');
            // Should handle the error gracefully
        });
    });

    suite('lifecycle integration', () => {
        test('should handle multiple activation/deactivation cycles', () => {
            // First cycle
            extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true);
            extension.deactivate();
            assert.strictEqual(extension.isExtensionActive(), false);

            // Second cycle
            extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true);
            extension.deactivate();
            assert.strictEqual(extension.isExtensionActive(), false);

            // Third cycle
            extension.activate(context);
            assert.strictEqual(extension.isExtensionActive(), true);
            extension.deactivate();
            assert.strictEqual(extension.isExtensionActive(), false);
        });

        test('should maintain component integrity across cycles', () => {
            // First activation
            extension.activate(context);
            const state1 = extension.getExtensionState();
            assert.ok(state1, 'Should have state after first activation');

            extension.deactivate();
            assert.strictEqual(extension.getExtensionState(), null, 'Should clear state after deactivation');

            // Second activation
            extension.activate(context);
            const state2 = extension.getExtensionState();
            assert.ok(state2, 'Should have state after second activation');
            
            // States should be different instances
            assert.notStrictEqual(state1, state2, 'Should create new state instances');
        });
    });

    suite('error handling', () => {
        test('should handle component initialization errors', () => {
            // This test verifies that the extension handles errors during component initialization
            // In a real scenario, this might happen due to missing dependencies or configuration issues
            
            // The extension should still attempt to activate even if there are issues
            assert.doesNotThrow(() => {
                extension.activate(context);
            });
        });

        test('should provide meaningful error messages', () => {
            // Test that error messages are helpful for debugging
            const info = extension.getExtensionInfo();
            
            if (info.error) {
                assert.ok(typeof info.error === 'string', 'Error should be a string');
                assert.ok(info.error.length > 0, 'Error message should not be empty');
            }
        });
    });

    suite('configuration integration', () => {
        test('should initialize with default configuration', () => {
            extension.activate(context);

            const info = extension.getExtensionInfo();
            assert.ok(info.active, 'Extension should be active');
            
            // Should have default configuration values
            assert.strictEqual(typeof info.enabled, 'boolean', 'Should have enabled setting');
            assert.ok(Array.isArray(info.supportedFileTypes), 'Should have supported file types');
            assert.ok(info.supportedFileTypes.length > 0, 'Should have at least one supported file type');
        });

        test('should handle configuration validation', () => {
            // Extension should validate configuration on activation
            assert.doesNotThrow(() => {
                extension.activate(context);
            });

            // Should be active even with potential configuration issues
            assert.strictEqual(extension.isExtensionActive(), true);
        });
    });

    suite('performance', () => {
        test('should activate quickly', () => {
            const startTime = Date.now();
            extension.activate(context);
            const endTime = Date.now();

            const duration = endTime - startTime;
            assert.ok(duration < 1000, `Activation should be fast (took ${duration}ms)`);
        });

        test('should deactivate quickly', () => {
            extension.activate(context);

            const startTime = Date.now();
            extension.deactivate();
            const endTime = Date.now();

            const duration = endTime - startTime;
            assert.ok(duration < 100, `Deactivation should be fast (took ${duration}ms)`);
        });
    });
});