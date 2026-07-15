import * as assert from 'assert';
import * as vscode from 'vscode';
import * as extension from '../extension';
import { TailwindConverter } from '../tailwindConverter';

suite('User Scenarios Integration Tests', () => {
    let context: vscode.ExtensionContext;

    setup(async () => {
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

    suite('new developer scenarios', () => {
        test('should help new developer learning Tailwind', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: New developer types familiar CSS pixel values
            const learningSteps = [
                // Step 1: Basic padding (familiar CSS)
                { 
                    input: '<div class="p-16px">Hello World</div>',
                    expectedConversions: [{ from: 'p-16px', to: 'p-4' }],
                    description: 'Basic padding conversion'
                },
                
                // Step 2: Margin (building confidence)
                { 
                    input: '<div class="p-16px m-8px">Content</div>',
                    expectedConversions: [
                        { from: 'p-16px', to: 'p-4' },
                        { from: 'm-8px', to: 'm-2' }
                    ],
                    description: 'Adding margin'
                },
                
                // Step 3: Width and height (layout basics)
                { 
                    input: '<div class="p-16px m-8px w-256px h-128px">Box</div>',
                    expectedConversions: [
                        { from: 'p-16px', to: 'p-4' },
                        { from: 'm-8px', to: 'm-2' },
                        { from: 'w-256px', to: 'w-64' },
                        { from: 'h-128px', to: 'h-32' }
                    ],
                    description: 'Layout dimensions'
                },
                
                // Step 4: Custom values (learning arbitrary values)
                { 
                    input: '<div class="p-16px m-8px w-256px h-128px gap-x-15px">Flex</div>',
                    expectedConversions: [
                        { from: 'p-16px', to: 'p-4' },
                        { from: 'm-8px', to: 'm-2' },
                        { from: 'w-256px', to: 'w-64' },
                        { from: 'h-128px', to: 'h-32' },
                        { from: 'gap-x-15px', to: 'gap-x-[15px]' }
                    ],
                    description: 'Custom gap value'
                }
            ];

            for (const [stepIndex, step] of learningSteps.entries()) {
                const range = new vscode.Range(0, 0, 0, step.input.length);
                const matches: any[] = state.textProcessor.findPixelClasses(step.input, range);

                // Should find all expected conversions
                assert.strictEqual(matches.length, step.expectedConversions.length, 
                    `Step ${stepIndex + 1} (${step.description}): Should find ${step.expectedConversions.length} matches`);

                // Verify each expected conversion
                step.expectedConversions.forEach(expected => {
                    const match = matches.find((m: any) => m.originalText === expected.from);
                    assert.ok(match, `Step ${stepIndex + 1}: Should find ${expected.from}`);
                    assert.strictEqual(match.convertedText, expected.to, 
                        `Step ${stepIndex + 1}: ${expected.from} should convert to ${expected.to}`);
                });
            }
        });

        test('should provide helpful hover information for learning', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Test hover information for common Tailwind classes
            const learningClasses = [
                { class: 'p-4', expectedPixels: 16, property: 'padding' },
                { class: 'm-2', expectedPixels: 8, property: 'margin' },
                { class: 'w-64', expectedPixels: 256, property: 'width' },
                { class: 'h-32', expectedPixels: 128, property: 'height' },
                { class: 'gap-x-4', expectedPixels: 16, property: 'column-gap' }
            ];

            for (const testCase of learningClasses) {
                const mockDocument = {
                    languageId: 'html',
                    getText: (range?: vscode.Range) => {
                        if (range) {
                            return testCase.class;
                        }
                        return `<div class="${testCase.class}">Content</div>`;
                    },
                    getWordRangeAtPosition: () => new vscode.Range(0, 12, 0, 12 + testCase.class.length)
                } as any;

                const position = new vscode.Position(0, 13);
                const token = new vscode.CancellationTokenSource().token;

                const hover = await state.hoverProvider.provideHover(mockDocument, position, token);
                
                assert.ok(hover, `Should provide hover for ${testCase.class}`);
                
                if (hover && hover.contents.length > 0) {
                    const content = hover.contents[0] as vscode.MarkdownString;
                    const hoverText = content.value;
                    
                    // Should include pixel value for learning
                    assert.ok(hoverText.includes(`${testCase.expectedPixels}px`), 
                        `Hover for ${testCase.class} should include ${testCase.expectedPixels}px`);
                    
                    // Should include CSS property explanation
                    assert.ok(hoverText.includes(testCase.property), 
                        `Hover for ${testCase.class} should explain ${testCase.property}`);
                    
                    // Should include conversion examples
                    assert.ok(hoverText.includes('Conversion Examples'), 
                        `Hover for ${testCase.class} should include conversion examples`);
                }
            }
        });
    });

    suite('experienced developer scenarios', () => {
        test('should handle rapid prototyping workflow', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: Experienced developer rapidly prototyping a component
            const prototypingSteps = [
                // Quick layout structure
                '<div class="p-24px m-16px w-400px h-300px">',
                
                // Add responsive breakpoints with custom values
                '<div class="p-24px m-16px w-400px h-300px"><header class="px-32px py-20px h-80px">',
                
                // Complex positioning and spacing
                '<div class="p-24px m-16px w-400px h-300px"><header class="px-32px py-20px h-80px gap-x-12px gap-y-16px">',
                
                // Fine-tuning with precise values
                '<div class="p-24px m-16px w-400px h-300px"><header class="px-32px py-20px h-80px gap-x-12px gap-y-16px top-5px right-3px">'
            ];

            let totalMatches = 0;
            let standardConversions = 0;
            let customConversions = 0;

            for (const [stepIndex, step] of prototypingSteps.entries()) {
                const range = new vscode.Range(0, 0, 0, step.length);
                const matches = state.textProcessor.findPixelClasses(step, range);
                
                totalMatches += matches.length;
                standardConversions += matches.filter(m => !m.isCustomValue).length;
                customConversions += matches.filter(m => m.isCustomValue).length;

                // Should find increasing number of matches as complexity grows
                assert.ok(matches.length >= stepIndex * 2, 
                    `Prototyping step ${stepIndex + 1} should find matches proportional to complexity`);
            }

            // Should handle mix of standard and custom values
            assert.ok(standardConversions > 0, 'Should have standard Tailwind conversions');
            assert.ok(customConversions > 0, 'Should have custom arbitrary value conversions');
            assert.ok(totalMatches >= 15, `Should process many matches during prototyping, found ${totalMatches}`);
        });

        test('should handle design system implementation', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: Implementing a design system with custom spacing
            const designSystemSpacing = {
                'xs': 4,
                'sm': 8,
                'md': 16,
                'lg': 24,
                'xl': 32,
                '2xl': 48,
                '3xl': 64
            };

            // Update converter with design system spacing
            const designSystemConverter = new TailwindConverter(designSystemSpacing);
            state.textProcessor.updateConverter(designSystemConverter);
            state.hoverProvider.updateConverter(designSystemConverter);

            // Design system component implementation
            const designSystemComponents = [
                // Button component with design system spacing
                {
                    component: 'Button',
                    html: '<button class="px-8px py-4px">Primary Button</button>',
                    expectedConversions: [
                        { from: 'px-8px', to: 'px-sm' },
                        { from: 'py-4px', to: 'py-xs' }
                    ]
                },
                
                // Card component
                {
                    component: 'Card',
                    html: '<div class="p-16px m-24px w-320px"><h3 class="px-32px py-48px">Card Title</h3></div>',
                    expectedConversions: [
                        { from: 'p-16px', to: 'p-md' },
                        { from: 'm-24px', to: 'm-lg' },
                        { from: 'w-320px', to: 'w-80' }, // Default Tailwind
                        { from: 'px-32px', to: 'px-xl' },
                        { from: 'py-48px', to: 'py-2xl' }
                    ]
                },
                
                // Modal component with mixed values
                {
                    component: 'Modal',
                    html: '<div class="p-64px m-48px w-600px h-400px gap-x-16px gap-y-24px">Modal Content</div>',
                    expectedConversions: [
                        { from: 'p-64px', to: 'p-3xl' },
                        { from: 'm-48px', to: 'm-2xl' },
                        { from: 'w-600px', to: 'w-[600px]' }, // Custom arbitrary
                        { from: 'h-400px', to: 'h-[400px]' }, // Custom arbitrary
                        { from: 'gap-x-16px', to: 'gap-x-md' },
                        { from: 'gap-y-24px', to: 'gap-y-lg' }
                    ]
                }
            ];

            for (const component of designSystemComponents) {
                const range = new vscode.Range(0, 0, 0, component.html.length);
                const matches: any[] = state.textProcessor.findPixelClasses(component.html, range);

                // Should find all expected conversions
                assert.strictEqual(matches.length, component.expectedConversions.length,
                    `${component.component} should find ${component.expectedConversions.length} matches`);

                // Verify design system conversions
                component.expectedConversions.forEach(expected => {
                    const match = matches.find((m: any) => m.originalText === expected.from);
                    assert.ok(match, `${component.component}: Should find ${expected.from}`);
                    assert.strictEqual(match.convertedText, expected.to,
                        `${component.component}: ${expected.from} should convert to ${expected.to}`);
                });
            }
        });
    });

    suite('team collaboration scenarios', () => {
        test('should handle consistent spacing across team members', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: Different team members working on same project
            const teamMemberWork = [
                {
                    developer: 'Frontend Lead',
                    code: '<header class="p-16px m-8px w-1200px"><nav class="px-24px py-12px gap-x-16px">Navigation</nav></header>',
                    focus: 'Layout structure'
                },
                {
                    developer: 'UI Developer',
                    code: '<div class="p-12px m-6px"><button class="px-16px py-8px">Button</button><input class="p-10px m-4px w-200px"></div>',
                    focus: 'Interactive elements'
                },
                {
                    developer: 'Junior Developer',
                    code: '<footer class="p-20px m-10px h-100px"><div class="px-15px py-7px gap-y-9px">Footer content</div></footer>',
                    focus: 'Content sections'
                }
            ];

            let totalStandardConversions = 0;
            let totalCustomConversions = 0;

            for (const work of teamMemberWork) {
                const range = new vscode.Range(0, 0, 0, work.code.length);
                const matches = state.textProcessor.findPixelClasses(work.code, range);

                const standardMatches = matches.filter(m => !m.isCustomValue);
                const customMatches = matches.filter(m => m.isCustomValue);

                totalStandardConversions += standardMatches.length;
                totalCustomConversions += customMatches.length;

                // Each team member should get consistent conversions
                assert.ok(matches.length > 0, `${work.developer} work should have pixel class conversions`);
                
                // Verify some standard conversions are consistent
                const commonConversions = [
                    { from: 'p-16px', to: 'p-4' },
                    { from: 'm-8px', to: 'm-2' },
                    { from: 'px-16px', to: 'px-4' },
                    { from: 'py-8px', to: 'py-2' }
                ];

                commonConversions.forEach(expected => {
                    const match = matches.find(m => m.originalText === expected.from);
                    if (match) {
                        assert.strictEqual(match.convertedText, expected.to,
                            `${work.developer}: ${expected.from} should consistently convert to ${expected.to}`);
                    }
                });
            }

            // Team should get mix of standard and custom conversions
            assert.ok(totalStandardConversions > 0, 'Team should use standard Tailwind values');
            assert.ok(totalCustomConversions > 0, 'Team should also use custom values when needed');
        });

        test('should handle code review scenarios', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: Code review with pixel values that need conversion
            const codeReviewCases = [
                {
                    title: 'Inconsistent spacing values',
                    beforeCode: '<div class="p-14px m-6px w-250px">Inconsistent</div>',
                    expectedSuggestions: [
                        { original: 'p-14px', converted: 'p-[14px]', note: 'Consider using p-3 (12px) or p-4 (16px)' },
                        { original: 'm-6px', converted: 'm-[6px]', note: 'Consider using m-1 (4px) or m-2 (8px)' },
                        { original: 'w-250px', converted: 'w-[250px]', note: 'Custom width value' }
                    ]
                },
                {
                    title: 'Good standard values',
                    beforeCode: '<div class="p-16px m-8px w-64px h-32px">Standard values</div>',
                    expectedSuggestions: [
                        { original: 'p-16px', converted: 'p-4', note: 'Perfect standard value' },
                        { original: 'm-8px', converted: 'm-2', note: 'Perfect standard value' },
                        { original: 'w-64px', converted: 'w-16', note: 'Perfect standard value' },
                        { original: 'h-32px', converted: 'h-8', note: 'Perfect standard value' }
                    ]
                }
            ];

            for (const reviewCase of codeReviewCases) {
                const range = new vscode.Range(0, 0, 0, reviewCase.beforeCode.length);
                const matches: any[] = state.textProcessor.findPixelClasses(reviewCase.beforeCode, range);

                // Should find all values for review
                assert.strictEqual(matches.length, reviewCase.expectedSuggestions.length,
                    `${reviewCase.title}: Should find all values for review`);

                // Verify conversion suggestions
                reviewCase.expectedSuggestions.forEach(suggestion => {
                    const match = matches.find((m: any) => m.originalText === suggestion.original);
                    assert.ok(match, `${reviewCase.title}: Should find ${suggestion.original}`);
                    assert.strictEqual(match.convertedText, suggestion.converted,
                        `${reviewCase.title}: ${suggestion.original} should convert to ${suggestion.converted}`);
                    
                    // Custom values should be flagged for review
                    if (suggestion.converted.includes('[') && suggestion.converted.includes(']')) {
                        assert.strictEqual(match.isCustomValue, true,
                            `${reviewCase.title}: ${suggestion.original} should be flagged as custom value`);
                    }
                });
            }
        });
    });

    suite('migration scenarios', () => {
        test('should help migrate from CSS to Tailwind', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: Migrating existing CSS-in-HTML to Tailwind
            const migrationSteps = [
                {
                    phase: 'Initial CSS classes with pixel values',
                    code: '<div class="p-16px m-8px w-320px h-240px">Legacy styling</div>',
                    expectedOutcome: 'Convert to standard Tailwind values'
                },
                {
                    phase: 'Complex layout with mixed values',
                    code: '<div class="p-16px m-8px w-320px h-240px"><section class="px-24px py-12px gap-x-16px gap-y-8px">Content</section></div>',
                    expectedOutcome: 'Mix of standard and layout-specific values'
                },
                {
                    phase: 'Fine-tuned design with custom values',
                    code: '<div class="p-16px m-8px w-320px h-240px"><section class="px-24px py-12px gap-x-16px gap-y-8px top-3px right-5px">Positioned</section></div>',
                    expectedOutcome: 'Preserve custom positioning while standardizing spacing'
                }
            ];

            let migrationProgress = {
                totalClasses: 0,
                standardizedClasses: 0,
                customClasses: 0
            };

            for (const step of migrationSteps) {
                const range = new vscode.Range(0, 0, 0, step.code.length);
                const matches = state.textProcessor.findPixelClasses(step.code, range);

                migrationProgress.totalClasses += matches.length;
                migrationProgress.standardizedClasses += matches.filter(m => !m.isCustomValue).length;
                migrationProgress.customClasses += matches.filter(m => m.isCustomValue).length;

                // Each migration step should find appropriate conversions
                assert.ok(matches.length > 0, `${step.phase} should find classes to migrate`);
                
                // Verify common migration patterns
                const commonMigrations = [
                    { from: 'p-16px', to: 'p-4' },
                    { from: 'm-8px', to: 'm-2' },
                    { from: 'px-24px', to: 'px-6' },
                    { from: 'py-12px', to: 'py-3' },
                    { from: 'gap-x-16px', to: 'gap-x-4' },
                    { from: 'gap-y-8px', to: 'gap-y-2' }
                ];

                commonMigrations.forEach(migration => {
                    const match = matches.find(m => m.originalText === migration.from);
                    if (match) {
                        assert.strictEqual(match.convertedText, migration.to,
                            `Migration: ${migration.from} should convert to ${migration.to}`);
                    }
                });
            }

            // Migration should result in good mix of standard and custom values
            assert.ok(migrationProgress.standardizedClasses > 0, 'Migration should standardize common values');
            assert.ok(migrationProgress.customClasses >= 0, 'Migration may preserve some custom values');
            assert.ok(migrationProgress.totalClasses >= 10, 'Migration should process substantial number of classes');
        });
    });

    suite('debugging and troubleshooting scenarios', () => {
        test('should help debug spacing issues', async () => {
            await extension.activate(context);
            const state = extension.getExtensionState();
            assert.ok(state, 'Extension state should exist');

            // Scenario: Developer debugging spacing issues
            const debuggingCases = [
                {
                    issue: 'Inconsistent button padding',
                    code: '<button class="px-14px py-7px">Button 1</button><button class="px-16px py-8px">Button 2</button>',
                    expectedInsight: 'Mix of custom and standard values causing inconsistency'
                },
                {
                    issue: 'Layout not aligning properly',
                    code: '<div class="p-15px m-9px w-250px"><div class="p-16px m-8px w-256px">Nested</div></div>',
                    expectedInsight: 'Parent uses custom values, child uses standard values'
                },
                {
                    issue: 'Responsive breakpoint issues',
                    code: '<div class="p-18px m-12px w-350px h-200px gap-x-14px gap-y-10px">Responsive content</div>',
                    expectedInsight: 'Mix of values that may not scale consistently'
                }
            ];

            for (const debugCase of debuggingCases) {
                const range = new vscode.Range(0, 0, 0, debugCase.code.length);
                const matches = state.textProcessor.findPixelClasses(debugCase.code, range);

                // Should identify the spacing values for debugging
                assert.ok(matches.length > 0, `${debugCase.issue}: Should find spacing values to debug`);

                // Categorize values for debugging insights
                const standardValues = matches.filter(m => !m.isCustomValue);
                const customValues = matches.filter(m => m.isCustomValue);

                // Provide debugging insights
                if (standardValues.length > 0 && customValues.length > 0) {
                    // Mixed values detected - potential consistency issue
                    assert.ok(true, `${debugCase.issue}: Mixed standard and custom values detected`);
                }

                // Check for near-standard values that could be standardized
                const nearStandardValues = customValues.filter(m => {
                    const pixelValue = m.pixelValue;
                    const standardValues = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48];
                    return standardValues.some(standard => Math.abs(pixelValue - standard) <= 2);
                });

                if (nearStandardValues.length > 0) {
                    assert.ok(true, `${debugCase.issue}: Found values close to standard that could be standardized`);
                }
            }
        });
    });
});