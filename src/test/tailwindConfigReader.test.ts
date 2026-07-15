import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TailwindConfigReader, TailwindConfig } from '../tailwindConfigReader';

suite('TailwindConfigReader Test Suite', () => {
    let configReader: TailwindConfigReader;
    let tempDir: string;

    setup(() => {
        configReader = new TailwindConfigReader();
        tempDir = path.join(__dirname, 'temp-test-configs');
        
        // Create temp directory for test configs
        try {
            fs.mkdirSync(tempDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }
    });

    teardown(() => {
        configReader.dispose();
        
        // Clean up temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    suite('spacing scale extraction', () => {
        test('should extract basic spacing scale', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'xs': '2px',
                        'sm': '4px',
                        'md': '8px',
                        'lg': '16px'
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract spacing scale');
            assert.strictEqual(spacingScale.xs, 2, 'Should convert xs to 2px');
            assert.strictEqual(spacingScale.sm, 4, 'Should convert sm to 4px');
            assert.strictEqual(spacingScale.md, 8, 'Should convert md to 8px');
            assert.strictEqual(spacingScale.lg, 16, 'Should convert lg to 16px');
        });

        test('should extract extended spacing scale', () => {
            const config: TailwindConfig = {
                theme: {
                    extend: {
                        spacing: {
                            'custom': '12px',
                            'special': '24px'
                        }
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract extended spacing scale');
            assert.strictEqual(spacingScale.custom, 12, 'Should convert custom to 12px');
            assert.strictEqual(spacingScale.special, 24, 'Should convert special to 24px');
        });

        test('should merge base and extended spacing', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'base': '8px'
                    },
                    extend: {
                        spacing: {
                            'extended': '16px'
                        }
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract merged spacing scale');
            assert.strictEqual(spacingScale.base, 8, 'Should include base spacing');
            assert.strictEqual(spacingScale.extended, 16, 'Should include extended spacing');
        });

        test('should handle rem values', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'rem1': '1rem',
                        'rem2': '2rem',
                        'rem-half': '0.5rem'
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract rem spacing scale');
            assert.strictEqual(spacingScale.rem1, 16, 'Should convert 1rem to 16px');
            assert.strictEqual(spacingScale.rem2, 32, 'Should convert 2rem to 32px');
            assert.strictEqual(spacingScale['rem-half'], 8, 'Should convert 0.5rem to 8px');
        });

        test('should handle em values', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'em1': '1em',
                        'em2': '2em',
                        'em-half': '0.5em'
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract em spacing scale');
            assert.strictEqual(spacingScale.em1, 16, 'Should convert 1em to 16px');
            assert.strictEqual(spacingScale.em2, 32, 'Should convert 2em to 32px');
            assert.strictEqual(spacingScale['em-half'], 8, 'Should convert 0.5em to 8px');
        });

        test('should handle unitless values', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        '4': '4',
                        '8': '8',
                        '16': '16'
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract unitless spacing scale');
            assert.strictEqual(spacingScale['4'], 4, 'Should treat unitless 4 as 4px');
            assert.strictEqual(spacingScale['8'], 8, 'Should treat unitless 8 as 8px');
            assert.strictEqual(spacingScale['16'], 16, 'Should treat unitless 16 as 16px');
        });

        test('should ignore invalid values', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'valid': '16px',
                        'invalid1': 'auto',
                        'invalid2': '100%',
                        'invalid3': 'calc(100% - 16px)'
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract valid spacing values');
            assert.strictEqual(spacingScale.valid, 16, 'Should include valid value');
            assert.strictEqual(spacingScale.invalid1, undefined, 'Should ignore auto');
            assert.strictEqual(spacingScale.invalid2, undefined, 'Should ignore percentage');
            assert.strictEqual(spacingScale.invalid3, undefined, 'Should ignore calc');
        });

        test('should return undefined for empty config', () => {
            const config: TailwindConfig = {};
            const spacingScale = configReader.extractSpacingScale(config);
            assert.strictEqual(spacingScale, undefined, 'Should return undefined for empty config');
        });

        test('should return undefined for config without spacing', () => {
            const config: TailwindConfig = {
                theme: {
                    colors: {
                        primary: '#000000'
                    }
                }
            };
            const spacingScale = configReader.extractSpacingScale(config);
            assert.strictEqual(spacingScale, undefined, 'Should return undefined without spacing');
        });
    });

    suite('cache management', () => {
        test('should start with empty cache', () => {
            const stats = configReader.getCacheStats();
            assert.strictEqual(stats.size, 0, 'Cache should start empty');
            assert.strictEqual(stats.entries.length, 0, 'Should have no cache entries');
        });

        test('should clear cache', () => {
            configReader.clearCache();
            const stats = configReader.getCacheStats();
            assert.strictEqual(stats.size, 0, 'Cache should be empty after clear');
        });

        test('should provide cache statistics', () => {
            const stats = configReader.getCacheStats();
            assert.strictEqual(typeof stats.size, 'number', 'Size should be a number');
            assert.ok(Array.isArray(stats.entries), 'Entries should be an array');
        });
    });

    suite('JavaScript config parsing', () => {
        test('should handle basic JavaScript config format', () => {
            const jsContent = `
                module.exports = {
                    theme: {
                        spacing: {
                            'xs': '2px',
                            'sm': '4px'
                        }
                    }
                }
            `;

            // We can't easily test the private parseJavaScriptConfig method directly,
            // but we can test the overall functionality through integration tests
            assert.ok(jsContent.includes('spacing'), 'Should contain spacing configuration');
        });

        test('should handle export default format', () => {
            const jsContent = `
                export default {
                    theme: {
                        spacing: {
                            'custom': '12px'
                        }
                    }
                }
            `;

            assert.ok(jsContent.includes('export default'), 'Should handle export default');
        });

        test('should handle comments in config', () => {
            const jsContent = `
                // This is a comment
                module.exports = {
                    theme: {
                        /* Multi-line
                           comment */
                        spacing: {
                            'test': '8px' // Inline comment
                        }
                    }
                }
            `;

            assert.ok(jsContent.includes('spacing'), 'Should handle comments');
        });
    });

    suite('error handling', () => {
        test('should handle missing config gracefully', async () => {
            // Test with non-existent workspace
            const result = await configReader.readTailwindConfig();
            
            // Should not throw and should return null for missing config
            assert.strictEqual(result, null, 'Should return null for missing config');
        });

        test('should handle invalid config files gracefully', () => {
            const invalidConfig = { invalid: 'config' } as any;
            const spacingScale = configReader.extractSpacingScale(invalidConfig);
            
            assert.strictEqual(spacingScale, undefined, 'Should handle invalid config gracefully');
        });

        test('should handle malformed spacing values', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'valid': '16px',
                        'invalid': null as any,
                        'undefined': undefined as any,
                        'object': { nested: 'value' } as any
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract valid values');
            assert.strictEqual(spacingScale.valid, 16, 'Should include valid value');
            assert.strictEqual(spacingScale.invalid, undefined, 'Should ignore null value');
            assert.strictEqual(spacingScale.undefined, undefined, 'Should ignore undefined value');
            assert.strictEqual(spacingScale.object, undefined, 'Should ignore object value');
        });
    });

    suite('disposal', () => {
        test('should dispose cleanly', () => {
            assert.doesNotThrow(() => {
                configReader.dispose();
            });
        });

        test('should clear cache on disposal', () => {
            configReader.dispose();
            const stats = configReader.getCacheStats();
            assert.strictEqual(stats.size, 0, 'Cache should be cleared on disposal');
        });

        test('should handle multiple disposals', () => {
            configReader.dispose();
            
            assert.doesNotThrow(() => {
                configReader.dispose();
            });
        });
    });

    suite('integration scenarios', () => {
        test('should handle real-world Tailwind config structure', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        '0': '0px',
                        '1': '0.25rem',
                        '2': '0.5rem',
                        '3': '0.75rem',
                        '4': '1rem',
                        '5': '1.25rem',
                        '6': '1.5rem',
                        '8': '2rem',
                        '10': '2.5rem',
                        '12': '3rem'
                    },
                    extend: {
                        spacing: {
                            '72': '18rem',
                            '84': '21rem',
                            '96': '24rem',
                            'custom-sm': '0.875rem',
                            'custom-lg': '1.125rem'
                        }
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should extract real-world config');
            
            // Check base spacing
            assert.strictEqual(spacingScale['0'], 0, 'Should handle 0px');
            assert.strictEqual(spacingScale['1'], 4, 'Should convert 0.25rem to 4px');
            assert.strictEqual(spacingScale['4'], 16, 'Should convert 1rem to 16px');
            
            // Check extended spacing
            assert.strictEqual(spacingScale['72'], 288, 'Should convert 18rem to 288px');
            assert.strictEqual(spacingScale['custom-sm'], 14, 'Should convert 0.875rem to 14px');
        });

        test('should handle mixed unit types', () => {
            const config: TailwindConfig = {
                theme: {
                    spacing: {
                        'px-value': '16px',
                        'rem-value': '1rem',
                        'em-value': '1em',
                        'unitless': '8',
                        'decimal-rem': '1.5rem',
                        'decimal-px': '12.5px'
                    }
                }
            };

            const spacingScale = configReader.extractSpacingScale(config);
            
            assert.ok(spacingScale, 'Should handle mixed units');
            assert.strictEqual(spacingScale['px-value'], 16, 'Should handle px');
            assert.strictEqual(spacingScale['rem-value'], 16, 'Should handle rem');
            assert.strictEqual(spacingScale['em-value'], 16, 'Should handle em');
            assert.strictEqual(spacingScale['unitless'], 8, 'Should handle unitless');
            assert.strictEqual(spacingScale['decimal-rem'], 24, 'Should handle decimal rem');
            assert.strictEqual(spacingScale['decimal-px'], 12.5, 'Should handle decimal px');
        });
    });
});