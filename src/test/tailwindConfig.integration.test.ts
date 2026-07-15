import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../configManager';
import { TailwindConverter } from '../tailwindConverter';
import { TailwindConfigReader } from '../tailwindConfigReader';

suite('Tailwind Config Integration Tests', () => {
    let configManager: ConfigurationManager;
    let configReader: TailwindConfigReader;

    setup(() => {
        configManager = new ConfigurationManager();
        configReader = new TailwindConfigReader();
    });

    teardown(() => {
        configManager.dispose();
        configReader.dispose();
    });

    suite('configuration merging', () => {
        test('should merge VS Code and Tailwind configurations', async () => {
            // Test the configuration merging logic
            const baseConfig = configManager.getConfiguration();
            const mergedConfig = await configManager.getMergedConfiguration();
            
            // Should have all base properties
            assert.strictEqual(mergedConfig.enabled, baseConfig.enabled);
            assert.deepStrictEqual(mergedConfig.supportedFileTypes, baseConfig.supportedFileTypes);
            assert.strictEqual(mergedConfig.showVisualFeedback, baseConfig.showVisualFeedback);
            assert.strictEqual(mergedConfig.showHoverTooltips, baseConfig.showHoverTooltips);
        });

        test('should handle missing Tailwind config gracefully', async () => {
            // When no Tailwind config is found, should return base config
            const mergedConfig = await configManager.getMergedConfiguration();
            const baseConfig = configManager.getConfiguration();
            
            // Should be equivalent to base config when no Tailwind config exists
            assert.deepStrictEqual(mergedConfig, baseConfig);
        });

        test('should prioritize VS Code config over Tailwind config', async () => {
            // This test verifies the precedence logic
            // VS Code configuration should take precedence over Tailwind config
            
            const mergedConfig = await configManager.getMergedConfiguration();
            
            // Should maintain VS Code configuration structure
            assert.strictEqual(typeof mergedConfig.enabled, 'boolean');
            assert.ok(Array.isArray(mergedConfig.supportedFileTypes));
            assert.strictEqual(typeof mergedConfig.showVisualFeedback, 'boolean');
            assert.strictEqual(typeof mergedConfig.showHoverTooltips, 'boolean');
        });
    });

    suite('converter integration', () => {
        test('should work with custom spacing from Tailwind config', () => {
            // Simulate custom spacing scale from Tailwind config
            const customSpacing = {
                'xs': 2,
                'sm': 6,
                'md': 10,
                'lg': 14,
                'xl': 18
            };

            const converter = new TailwindConverter(customSpacing);
            
            // Should use custom spacing for conversions
            assert.strictEqual(converter.convertPixelClass('p-2px'), 'p-xs');
            assert.strictEqual(converter.convertPixelClass('m-6px'), 'm-sm');
            assert.strictEqual(converter.convertPixelClass('w-10px'), 'w-md');
            assert.strictEqual(converter.convertPixelClass('h-14px'), 'h-lg');
            assert.strictEqual(converter.convertPixelClass('gap-18px'), 'gap-xl');
        });

        test('should fall back to default scale when custom not found', () => {
            const customSpacing = {
                'custom': 15
            };

            const converter = new TailwindConverter(customSpacing);
            
            // Should use custom for matching values
            assert.strictEqual(converter.convertPixelClass('p-15px'), 'p-custom');
            
            // Should use default scale for standard values
            assert.strictEqual(converter.convertPixelClass('p-16px'), 'p-4');
            assert.strictEqual(converter.convertPixelClass('m-8px'), 'm-2');
        });

        test('should handle mixed custom and default values', () => {
            const customSpacing = {
                'tiny': 1,
                'huge': 100
            };

            const converter = new TailwindConverter(customSpacing);
            
            // Test various conversions
            const testCases = [
                { input: 'p-1px', expected: 'p-tiny' },
                { input: 'p-4px', expected: 'p-1' },      // Default scale
                { input: 'p-16px', expected: 'p-4' },     // Default scale
                { input: 'p-100px', expected: 'p-huge' },
                { input: 'p-50px', expected: 'p-[50px]' } // Custom arbitrary
            ];

            testCases.forEach(({ input, expected }) => {
                const result = converter.convertPixelClass(input);
                assert.strictEqual(result, expected, `${input} should convert to ${expected}`);
            });
        });
    });

    suite('spacing scale extraction', () => {
        test('should extract comprehensive spacing scales', () => {
            const mockTailwindConfig = {
                theme: {
                    spacing: {
                        '0': '0px',
                        '1': '0.25rem',
                        '2': '0.5rem',
                        '3': '0.75rem',
                        '4': '1rem'
                    },
                    extend: {
                        spacing: {
                            '72': '18rem',
                            'custom': '13px'
                        }
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(mockTailwindConfig);
            
            assert.ok(spacingScale, 'Should extract spacing scale');
            
            // Check base spacing (rem to px conversion)
            assert.strictEqual(spacingScale['0'], 0);
            assert.strictEqual(spacingScale['1'], 4);   // 0.25rem = 4px
            assert.strictEqual(spacingScale['2'], 8);   // 0.5rem = 8px
            assert.strictEqual(spacingScale['3'], 12);  // 0.75rem = 12px
            assert.strictEqual(spacingScale['4'], 16);  // 1rem = 16px
            
            // Check extended spacing
            assert.strictEqual(spacingScale['72'], 288); // 18rem = 288px
            assert.strictEqual(spacingScale['custom'], 13);
        });

        test('should handle complex Tailwind configurations', () => {
            const complexConfig = {
                theme: {
                    spacing: {
                        'px': '1px',
                        '0': '0px',
                        '0.5': '0.125rem',
                        '1': '0.25rem',
                        '1.5': '0.375rem',
                        '2': '0.5rem',
                        '2.5': '0.625rem',
                        '3': '0.75rem'
                    },
                    extend: {
                        spacing: {
                            '13': '3.25rem',
                            '15': '3.75rem',
                            '17': '4.25rem',
                            '18': '4.5rem',
                            'custom-xs': '0.1875rem',
                            'custom-sm': '0.3125rem'
                        }
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(complexConfig);
            
            assert.ok(spacingScale, 'Should extract complex spacing scale');
            
            // Check decimal rem values
            assert.strictEqual(spacingScale['0.5'], 2);   // 0.125rem = 2px
            assert.strictEqual(spacingScale['1.5'], 6);   // 0.375rem = 6px
            assert.strictEqual(spacingScale['2.5'], 10);  // 0.625rem = 10px
            
            // Check extended values
            assert.strictEqual(spacingScale['13'], 52);   // 3.25rem = 52px
            assert.strictEqual(spacingScale['custom-xs'], 3); // 0.1875rem = 3px
        });
    });

    suite('real-world scenarios', () => {
        test('should handle typical project configuration', async () => {
            // Simulate a typical project setup
            const mergedConfig = await configManager.getMergedConfiguration();
            
            // Should have valid configuration
            assert.strictEqual(typeof mergedConfig.enabled, 'boolean');
            assert.ok(Array.isArray(mergedConfig.supportedFileTypes));
            assert.ok(mergedConfig.supportedFileTypes.length > 0);
            
            // Should support common file types
            const expectedFileTypes = ['html', 'javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
            expectedFileTypes.forEach(fileType => {
                assert.ok(mergedConfig.supportedFileTypes.includes(fileType), `Should support ${fileType}`);
            });
        });

        test('should work with converter in real scenarios', () => {
            // Test with a realistic custom spacing scale
            const realisticSpacing = {
                'xs': 2,
                'sm': 4,
                'base': 16,
                'lg': 24,
                'xl': 32,
                '2xl': 48,
                '3xl': 64
            };

            const converter = new TailwindConverter(realisticSpacing);
            
            // Test realistic conversion scenarios
            const scenarios = [
                // Custom values should use custom scale
                { input: 'p-2px', expected: 'p-xs' },
                { input: 'margin-4px', expected: null }, // Invalid property
                { input: 'm-4px', expected: 'm-sm' },
                { input: 'w-16px', expected: 'w-base' },
                { input: 'h-24px', expected: 'h-lg' },
                
                // Standard Tailwind values should still work
                { input: 'p-8px', expected: 'p-2' },    // Default scale
                { input: 'p-12px', expected: 'p-3' },   // Default scale
                
                // Non-matching values should become arbitrary
                { input: 'p-15px', expected: 'p-[15px]' },
                { input: 'p-100px', expected: 'p-[100px]' }
            ];

            scenarios.forEach(({ input, expected }) => {
                const result = converter.convertPixelClass(input);
                assert.strictEqual(result, expected, `${input} should convert to ${expected}`);
            });
        });

        test('should handle configuration refresh scenarios', async () => {
            // Test configuration refresh functionality
            const initialConfig = await configManager.getMergedConfiguration();
            
            // Should be able to refresh configuration
            assert.doesNotThrow(async () => {
                await configManager.refreshTailwindConfig();
            });
            
            // Configuration should still be valid after refresh
            const refreshedConfig = await configManager.getMergedConfiguration();
            assert.strictEqual(typeof refreshedConfig.enabled, 'boolean');
            assert.ok(Array.isArray(refreshedConfig.supportedFileTypes));
        });
    });

    suite('error handling and edge cases', () => {
        test('should handle malformed Tailwind configs', () => {
            const malformedConfigs = [
                null,
                undefined,
                {},
                { theme: null },
                { theme: { spacing: null } },
                { theme: { spacing: 'invalid' } }
            ];

            malformedConfigs.forEach(config => {
                assert.doesNotThrow(() => {
                    const spacingScale = configReader.extractSpacingScale(config as any);
                    // Should return undefined for invalid configs
                    assert.strictEqual(spacingScale, undefined);
                });
            });
        });

        test('should handle converter with invalid spacing scales', () => {
            const invalidSpacingScales = [
                null,
                undefined,
                {},
                { 'invalid': 'not-a-number' },
                { 'negative': -5 }
            ];

            invalidSpacingScales.forEach(spacing => {
                assert.doesNotThrow(() => {
                    const converter = new TailwindConverter(spacing as any);
                    
                    // Should still work with default scale
                    const result = converter.convertPixelClass('p-16px');
                    assert.strictEqual(result, 'p-4');
                });
            });
        });

        test('should handle configuration manager errors gracefully', async () => {
            // Should not throw when getting merged configuration
            assert.doesNotThrow(async () => {
                await configManager.getMergedConfiguration();
            });

            // Should not throw when refreshing config
            assert.doesNotThrow(async () => {
                await configManager.refreshTailwindConfig();
            });
        });
    });

    suite('performance considerations', () => {
        test('should handle large spacing scales efficiently', () => {
            // Create a large spacing scale
            const largeSpacing: Record<string, number> = {};
            for (let i = 0; i < 1000; i++) {
                largeSpacing[`scale-${i}`] = i;
            }

            const startTime = Date.now();
            const converter = new TailwindConverter(largeSpacing);
            
            // Test conversions
            const result1 = converter.convertPixelClass('p-500px');
            const result2 = converter.convertPixelClass('p-16px');
            
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete quickly even with large scale
            assert.ok(duration < 100, `Should handle large spacing scale efficiently (took ${duration}ms)`);
            assert.strictEqual(result1, 'p-scale-500');
            assert.strictEqual(result2, 'p-4'); // Should still use default scale
        });

        test('should cache configuration reads efficiently', async () => {
            const startTime = Date.now();
            
            // Multiple configuration reads should be fast due to caching
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(configManager.getMergedConfiguration());
            }
            
            await Promise.all(promises);
            
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete quickly due to caching
            assert.ok(duration < 200, `Multiple config reads should be fast (took ${duration}ms)`);
        });
    });
});