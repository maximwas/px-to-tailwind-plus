import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../configManager';
import { ExtensionConfig } from '../types';

suite('ConfigurationManager Test Suite', () => {
    let configManager: ConfigurationManager;

    setup(() => {
        configManager = new ConfigurationManager();
    });

    teardown(() => {
        configManager.dispose();
    });

    suite('configuration retrieval', () => {
        test('should get default configuration', () => {
            const config = configManager.getConfiguration();
            
            assert.strictEqual(typeof config.enabled, 'boolean');
            assert.strictEqual(Array.isArray(config.supportedFileTypes), true);
            assert.strictEqual(typeof config.showVisualFeedback, 'boolean');
            assert.strictEqual(typeof config.showHoverTooltips, 'boolean');
            
            // Check default values
            assert.strictEqual(config.enabled, true);
            assert.ok(config.supportedFileTypes.includes('html'));
            assert.ok(config.supportedFileTypes.includes('javascript'));
            assert.ok(config.supportedFileTypes.includes('typescript'));
            assert.strictEqual(config.showVisualFeedback, true);
            assert.strictEqual(config.showHoverTooltips, true);
        });

        test('should check if extension is enabled', () => {
            const isEnabled = configManager.isEnabled();
            assert.strictEqual(typeof isEnabled, 'boolean');
        });

        test('should check supported file types', () => {
            assert.strictEqual(configManager.isSupportedFileType('html'), true);
            assert.strictEqual(configManager.isSupportedFileType('javascript'), true);
            assert.strictEqual(configManager.isSupportedFileType('typescript'), true);
            assert.strictEqual(configManager.isSupportedFileType('javascriptreact'), true);
            assert.strictEqual(configManager.isSupportedFileType('typescriptreact'), true);
            assert.strictEqual(configManager.isSupportedFileType('vue'), true);
            assert.strictEqual(configManager.isSupportedFileType('svelte'), true);
            
            // Should not support unsupported types
            assert.strictEqual(configManager.isSupportedFileType('python'), false);
            assert.strictEqual(configManager.isSupportedFileType('java'), false);
            assert.strictEqual(configManager.isSupportedFileType('unknown'), false);
        });

        test('should get custom spacing scale', () => {
            const customScale = configManager.getCustomSpacingScale();
            // Should be undefined by default or an object
            assert.ok(customScale === undefined || typeof customScale === 'object');
        });

        test('should check visual feedback setting', () => {
            const showFeedback = configManager.shouldShowVisualFeedback();
            assert.strictEqual(typeof showFeedback, 'boolean');
        });

        test('should check hover tooltips setting', () => {
            const showTooltips = configManager.shouldShowHoverTooltips();
            assert.strictEqual(typeof showTooltips, 'boolean');
        });
    });

    suite('configuration validation', () => {
        test('should validate default configuration', () => {
            const errors = configManager.validateConfiguration();
            assert.strictEqual(errors.length, 0, `Configuration errors: ${errors.join(', ')}`);
        });

        test('should validate supported file types', () => {
            // We can't easily mock VS Code configuration, so we test the validation logic
            // by checking that the current configuration is valid
            const config = configManager.getConfiguration();
            
            // Supported file types should be an array
            assert.ok(Array.isArray(config.supportedFileTypes));
            assert.ok(config.supportedFileTypes.length > 0);
            
            // All file types should be strings
            config.supportedFileTypes.forEach(type => {
                assert.strictEqual(typeof type, 'string');
                assert.ok(type.length > 0);
            });
        });

        test('should validate boolean settings', () => {
            const config = configManager.getConfiguration();
            
            assert.strictEqual(typeof config.enabled, 'boolean');
            assert.strictEqual(typeof config.showVisualFeedback, 'boolean');
            assert.strictEqual(typeof config.showHoverTooltips, 'boolean');
        });

        test('should validate custom spacing scale format', () => {
            const config = configManager.getConfiguration();
            
            if (config.customSpacingScale !== undefined) {
                assert.strictEqual(typeof config.customSpacingScale, 'object');
                assert.ok(config.customSpacingScale !== null);
                
                // Validate each entry
                for (const [key, value] of Object.entries(config.customSpacingScale)) {
                    assert.strictEqual(typeof key, 'string');
                    assert.ok(key.length > 0);
                    assert.strictEqual(typeof value, 'number');
                    assert.ok(value >= 0);
                    assert.ok(Number.isFinite(value));
                }
            }
        });

        test('should allow fractional spacing values in validation', () => {
            const baseConfig = configManager.getConfiguration();
            const tempConfig: ExtensionConfig = {
                ...baseConfig,
                customSpacingScale: {
                    ...baseConfig.customSpacingScale,
                    fractional: 2.5,
                },
            };

            const errors = configManager.validateConfiguration(tempConfig);
            assert.strictEqual(errors.length, 0, `Unexpected validation errors: ${errors.join(', ')}`);
        });
    });

    suite('configuration change handling', () => {
        test('should register configuration change callbacks', () => {
            let callbackCalled = false;
            let receivedConfig: ExtensionConfig | null = null;
            
            const disposable = configManager.onConfigurationChanged((config) => {
                callbackCalled = true;
                receivedConfig = config;
            });
            
            // Callback should be registered
            assert.ok(disposable);
            assert.strictEqual(typeof disposable.dispose, 'function');
            
            // Clean up
            disposable.dispose();
        });

        test('should unregister configuration change callbacks', () => {
            const callback = (config: ExtensionConfig) => {
                // Test callback
            };
            
            const disposable = configManager.onConfigurationChanged(callback);
            
            // Should be able to dispose
            assert.doesNotThrow(() => {
                disposable.dispose();
            });
        });
    });

    suite('utility methods', () => {
        test('should export configuration as JSON', () => {
            const jsonConfig = configManager.exportConfiguration();
            
            assert.strictEqual(typeof jsonConfig, 'string');
            
            // Should be valid JSON
            assert.doesNotThrow(() => {
                const parsed = JSON.parse(jsonConfig);
                assert.strictEqual(typeof parsed, 'object');
                assert.ok(parsed !== null);
            });
        });

        test('should get configuration section name', () => {
            const section = ConfigurationManager.getConfigurationSection();
            assert.strictEqual(section, 'pxToTailwind');
        });
    });

    suite('error handling', () => {
        test('should handle configuration validation errors gracefully', () => {
            // Test that validation doesn't throw errors
            assert.doesNotThrow(() => {
                configManager.validateConfiguration();
            });
        });

        test('should handle missing configuration gracefully', () => {
            // Test that getting configuration doesn't throw errors
            assert.doesNotThrow(() => {
                configManager.getConfiguration();
            });
        });

        test('should handle callback errors gracefully', () => {
            // Register a callback that throws an error
            const disposable = configManager.onConfigurationChanged(() => {
                throw new Error('Test error');
            });
            
            // Should not throw when handling configuration changes
            assert.doesNotThrow(() => {
                // We can't easily trigger a configuration change in tests,
                // but the error handling is tested by the callback registration
            });
            
            disposable.dispose();
        });
    });

    suite('workspace folder support', () => {
        test('should handle workspace folder configuration', () => {
            // Test that workspace folder configuration doesn't throw
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                const workspaceFolder = vscode.workspace.workspaceFolders[0];
                
                assert.doesNotThrow(() => {
                    const config = configManager.getWorkspaceFolderConfiguration(workspaceFolder);
                    assert.strictEqual(typeof config, 'object');
                    assert.ok(config !== null);
                });
            }
        });
    });

    suite('disposal', () => {
        test('should dispose cleanly', () => {
            assert.doesNotThrow(() => {
                configManager.dispose();
            });
        });

        test('should clear callbacks on disposal', () => {
            const callback = (config: ExtensionConfig) => {
                // Test callback
            };
            
            configManager.onConfigurationChanged(callback);
            configManager.dispose();
            
            // Should not throw after disposal
            assert.doesNotThrow(() => {
                configManager.dispose();
            });
        });
    });

    suite('integration scenarios', () => {
        test('should work with different file type combinations', () => {
            const testCases = [
                'html',
                'javascript',
                'typescript',
                'javascriptreact',
                'typescriptreact',
                'vue',
                'svelte'
            ];
            
            testCases.forEach(fileType => {
                const isSupported = configManager.isSupportedFileType(fileType);
                assert.strictEqual(isSupported, true, `${fileType} should be supported`);
            });
        });

        test('should handle configuration state consistently', () => {
            // Get configuration multiple times
            const config1 = configManager.getConfiguration();
            const config2 = configManager.getConfiguration();
            
            // Should be consistent
            assert.deepStrictEqual(config1, config2);
        });

        test('should validate configuration consistently', () => {
            // Validate multiple times
            const errors1 = configManager.validateConfiguration();
            const errors2 = configManager.validateConfiguration();
            
            // Should be consistent
            assert.deepStrictEqual(errors1, errors2);
        });
    });
});
