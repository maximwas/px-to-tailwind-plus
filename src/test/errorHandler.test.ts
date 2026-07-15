import * as assert from 'assert';
import { ErrorHandler, ErrorSeverity, handleError, handleExpectedError, wrapAsync, wrapSync } from '../errorHandler';

suite('ErrorHandler Test Suite', () => {
    let errorHandler: ErrorHandler;

    setup(() => {
        errorHandler = ErrorHandler.getInstance();
        errorHandler.setTestMode(true);
        errorHandler.clearErrorCounts();
    });

    teardown(() => {
        errorHandler.clearErrorCounts();
        errorHandler.setTestMode(false);
    });

    suite('basic error handling', () => {
        test('should handle errors with context', async () => {
            const testError = new Error('Test error');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation',
                severity: ErrorSeverity.MEDIUM,
                data: { test: 'data' }
            };

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(testError, context);
            });
        });

        test('should handle expected errors', () => {
            const testError = new Error('Expected error');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };

            assert.doesNotThrow(() => {
                errorHandler.handleExpectedError(testError, context);
            });
        });

        test('should track error counts', async () => {
            const testError = new Error('Repeated error');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation',
                severity: ErrorSeverity.LOW
            };

            // Handle the same error multiple times
            await errorHandler.handleError(testError, context);
            await errorHandler.handleError(testError, context);
            await errorHandler.handleError(testError, context);

            const stats = errorHandler.getErrorStats();
            assert.ok(stats.totalErrors >= 3);
            assert.ok(stats.errorsByComponent.TestComponent >= 3);
        });
    });

    suite('error severity handling', () => {
        test('should handle critical errors', async () => {
            const testError = new Error('Critical error');
            const context = {
                component: 'TestComponent',
                operation: 'criticalOperation',
                severity: ErrorSeverity.CRITICAL
            };

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(testError, context);
            });
        });

        test('should handle high severity errors', async () => {
            const testError = new Error('High severity error');
            const context = {
                component: 'TestComponent',
                operation: 'highSeverityOperation',
                severity: ErrorSeverity.HIGH
            };

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(testError, context);
            });
        });

        test('should handle low severity errors', async () => {
            const testError = new Error('Low severity error');
            const context = {
                component: 'TestComponent',
                operation: 'lowSeverityOperation',
                severity: ErrorSeverity.LOW
            };

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(testError, context);
            });
        });
    });

    suite('async operation wrapping', () => {
        test('should wrap successful async operations', async () => {
            const result = await wrapAsync(async () => {
                return 'success';
            }, {
                component: 'TestComponent',
                operation: 'successfulAsyncOperation'
            });

            assert.strictEqual(result, 'success');
        });

        test('should wrap failing async operations', async () => {
            const result = await wrapAsync(async () => {
                throw new Error('Async operation failed');
            }, {
                component: 'TestComponent',
                operation: 'failingAsyncOperation',
                severity: ErrorSeverity.LOW
            });

            assert.strictEqual(result, null);
        });

        test('should handle async operations with data', async () => {
            const testData = { input: 'test' };
            
            const result = await wrapAsync(async () => {
                return testData.input.toUpperCase();
            }, {
                component: 'TestComponent',
                operation: 'dataProcessing',
                data: testData
            });

            assert.strictEqual(result, 'TEST');
        });
    });

    suite('sync operation wrapping', () => {
        test('should wrap successful sync operations', () => {
            const result = wrapSync(() => {
                return 'sync success';
            }, {
                component: 'TestComponent',
                operation: 'successfulSyncOperation'
            });

            assert.strictEqual(result, 'sync success');
        });

        test('should wrap failing sync operations', () => {
            const result = wrapSync(() => {
                throw new Error('Sync operation failed');
            }, {
                component: 'TestComponent',
                operation: 'failingSyncOperation',
                severity: ErrorSeverity.LOW
            });

            assert.strictEqual(result, null);
        });

        test('should handle sync operations with complex data', () => {
            const complexData = {
                numbers: [1, 2, 3, 4, 5],
                operation: 'sum'
            };

            const result = wrapSync(() => {
                return complexData.numbers.reduce((sum, num) => sum + num, 0);
            }, {
                component: 'TestComponent',
                operation: 'complexCalculation',
                data: complexData
            });

            assert.strictEqual(result, 15);
        });
    });

    suite('error statistics', () => {
        test('should provide error statistics', async () => {
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');

            await errorHandler.handleError(error1, {
                component: 'Component1',
                operation: 'operation1',
                severity: ErrorSeverity.LOW
            });

            await errorHandler.handleError(error2, {
                component: 'Component2',
                operation: 'operation2',
                severity: ErrorSeverity.MEDIUM
            });

            const stats = errorHandler.getErrorStats();
            
            assert.strictEqual(typeof stats.totalErrors, 'number');
            assert.ok(stats.totalErrors >= 2);
            assert.ok(typeof stats.errorsByComponent === 'object');
            assert.ok(Array.isArray(stats.recentErrors));
        });

        test('should clear error counts', async () => {
            const testError = new Error('Test error');
            await errorHandler.handleError(testError, {
                component: 'TestComponent',
                operation: 'testOperation'
            });

            let stats = errorHandler.getErrorStats();
            assert.ok(stats.totalErrors > 0);

            errorHandler.clearErrorCounts();
            stats = errorHandler.getErrorStats();
            assert.strictEqual(stats.totalErrors, 0);
        });
    });

    suite('convenience functions', () => {
        test('should work with convenience handleError function', async () => {
            const testError = new Error('Convenience error');
            
            await assert.doesNotReject(async () => {
                await handleError(testError, {
                    component: 'TestComponent',
                    operation: 'convenienceTest'
                });
            });
        });

        test('should work with convenience handleExpectedError function', () => {
            const testError = new Error('Expected convenience error');
            
            assert.doesNotThrow(() => {
                handleExpectedError(testError, {
                    component: 'TestComponent',
                    operation: 'expectedConvenienceTest'
                });
            });
        });
    });

    suite('error context validation', () => {
        test('should handle minimal error context', async () => {
            const testError = new Error('Minimal context error');
            const minimalContext = {
                component: 'TestComponent',
                operation: 'minimalTest'
            };

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(testError, minimalContext);
            });
        });

        test('should handle comprehensive error context', async () => {
            const testError = new Error('Comprehensive context error');
            const comprehensiveContext = {
                component: 'TestComponent',
                operation: 'comprehensiveTest',
                data: { complex: { nested: 'data' } },
                userMessage: 'Custom user message',
                severity: ErrorSeverity.HIGH,
                showToUser: true,
                suggestedAction: 'Try again'
            };

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(testError, comprehensiveContext);
            });
        });
    });

    suite('error throttling', () => {
        test('should throttle repeated errors', async () => {
            const testError = new Error('Repeated error');
            const context = {
                component: 'TestComponent',
                operation: 'repeatedOperation',
                severity: ErrorSeverity.LOW
            };

            // Handle the same error many times
            for (let i = 0; i < 15; i++) {
                await errorHandler.handleError(testError, context);
            }

            // Should not throw despite many errors
            const stats = errorHandler.getErrorStats();
            assert.ok(stats.totalErrors >= 15);
        });
    });

    suite('singleton behavior', () => {
        test('should maintain singleton instance', () => {
            const instance1 = ErrorHandler.getInstance();
            const instance2 = ErrorHandler.getInstance();
            
            assert.strictEqual(instance1, instance2);
        });
    });

    suite('edge cases', () => {
        test('should handle null/undefined errors gracefully', async () => {
            await assert.doesNotReject(async () => {
                await errorHandler.handleError(null as any, {
                    component: 'TestComponent',
                    operation: 'nullErrorTest'
                });
            });
        });

        test('should handle errors with circular references', async () => {
            const circularError = new Error('Circular error');
            const circularData: any = { test: 'data' };
            circularData.circular = circularData;

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(circularError, {
                    component: 'TestComponent',
                    operation: 'circularTest',
                    data: circularData
                });
            });
        });

        test('should handle very long error messages', async () => {
            const longMessage = 'A'.repeat(10000);
            const longError = new Error(longMessage);

            await assert.doesNotReject(async () => {
                await errorHandler.handleError(longError, {
                    component: 'TestComponent',
                    operation: 'longMessageTest'
                });
            });
        });
    });
});