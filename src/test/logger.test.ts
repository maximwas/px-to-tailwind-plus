import * as assert from 'assert';
import { Logger, LogLevel, log } from '../logger';

suite('Logger Test Suite', () => {
    let logger: Logger;

    setup(() => {
        logger = Logger.getInstance();
        logger.clear(); // Start with clean logs
    });

    teardown(() => {
        logger.clear();
    });

    suite('basic logging', () => {
        test('should log debug messages', () => {
            logger.debug('TestComponent', 'Debug message', { test: 'data' });
            
            const entries = logger.getRecentEntries(1);
            assert.strictEqual(entries.length, 1);
            assert.strictEqual(entries[0].level, LogLevel.DEBUG);
            assert.strictEqual(entries[0].component, 'TestComponent');
            assert.strictEqual(entries[0].message, 'Debug message');
        });

        test('should log info messages', () => {
            logger.info('TestComponent', 'Info message', { test: 'data' });
            
            const entries = logger.getRecentEntries(1);
            assert.strictEqual(entries.length, 1);
            assert.strictEqual(entries[0].level, LogLevel.INFO);
            assert.strictEqual(entries[0].message, 'Info message');
        });

        test('should log warning messages', () => {
            logger.warn('TestComponent', 'Warning message', { test: 'data' });
            
            const entries = logger.getRecentEntries(1);
            assert.strictEqual(entries.length, 1);
            assert.strictEqual(entries[0].level, LogLevel.WARN);
            assert.strictEqual(entries[0].message, 'Warning message');
        });

        test('should log error messages', () => {
            const testError = new Error('Test error');
            logger.error('TestComponent', 'Error message', testError, { test: 'data' });
            
            const entries = logger.getRecentEntries(1);
            assert.strictEqual(entries.length, 1);
            assert.strictEqual(entries[0].level, LogLevel.ERROR);
            assert.strictEqual(entries[0].message, 'Error message');
            assert.strictEqual(entries[0].error, testError);
        });
    });

    suite('log level filtering', () => {
        test('should respect log level filtering', () => {
            logger.setLogLevel(LogLevel.WARN);
            
            logger.debug('TestComponent', 'Debug message');
            logger.info('TestComponent', 'Info message');
            logger.warn('TestComponent', 'Warning message');
            logger.error('TestComponent', 'Error message');
            
            const entries = logger.getRecentEntries();
            assert.strictEqual(entries.length, 2); // Only WARN and ERROR should be logged
            assert.strictEqual(entries[0].level, LogLevel.WARN);
            assert.strictEqual(entries[1].level, LogLevel.ERROR);
        });

        test('should get and set log level', () => {
            logger.setLogLevel(LogLevel.ERROR);
            assert.strictEqual(logger.getLogLevel(), LogLevel.ERROR);
            
            logger.setLogLevel(LogLevel.DEBUG);
            assert.strictEqual(logger.getLogLevel(), LogLevel.DEBUG);
        });
    });

    suite('log entry management', () => {
        test('should maintain maximum log entries', () => {
            // Log more than the maximum
            for (let i = 0; i < 1100; i++) {
                logger.info('TestComponent', `Message ${i}`);
            }
            
            const entries = logger.getRecentEntries(2000);
            assert.ok(entries.length <= 1000, 'Should not exceed maximum log entries');
        });

        test('should get recent entries', () => {
            logger.info('TestComponent', 'Message 1');
            logger.info('TestComponent', 'Message 2');
            logger.info('TestComponent', 'Message 3');
            
            const recent = logger.getRecentEntries(2);
            assert.strictEqual(recent.length, 2);
            assert.strictEqual(recent[0].message, 'Message 2');
            assert.strictEqual(recent[1].message, 'Message 3');
        });

        test('should filter entries by level', () => {
            logger.info('TestComponent', 'Info message');
            logger.warn('TestComponent', 'Warning message');
            logger.error('TestComponent', 'Error message');
            
            const errorEntries = logger.getEntriesByLevel(LogLevel.ERROR);
            assert.strictEqual(errorEntries.length, 1);
            assert.strictEqual(errorEntries[0].message, 'Error message');
            
            const warnEntries = logger.getEntriesByLevel(LogLevel.WARN);
            assert.strictEqual(warnEntries.length, 1);
            assert.strictEqual(warnEntries[0].message, 'Warning message');
        });

        test('should filter entries by component', () => {
            logger.info('Component1', 'Message from component 1');
            logger.info('Component2', 'Message from component 2');
            logger.info('Component1', 'Another message from component 1');
            
            const component1Entries = logger.getEntriesByComponent('Component1');
            assert.strictEqual(component1Entries.length, 2);
            
            const component2Entries = logger.getEntriesByComponent('Component2');
            assert.strictEqual(component2Entries.length, 1);
        });
    });

    suite('log statistics', () => {
        test('should provide logging statistics', () => {
            logger.info('Component1', 'Info message');
            logger.warn('Component1', 'Warning message');
            logger.error('Component2', 'Error message');
            
            const stats = logger.getStats();
            
            assert.strictEqual(stats.totalEntries, 3);
            assert.strictEqual(stats.entriesByLevel.INFO, 1);
            assert.strictEqual(stats.entriesByLevel.WARN, 1);
            assert.strictEqual(stats.entriesByLevel.ERROR, 1);
            assert.strictEqual(stats.entriesByComponent.Component1, 2);
            assert.strictEqual(stats.entriesByComponent.Component2, 1);
            assert.ok(stats.oldestEntry);
            assert.ok(stats.newestEntry);
        });

        test('should handle empty log statistics', () => {
            logger.clear();
            
            const stats = logger.getStats();
            
            assert.strictEqual(stats.totalEntries, 0);
            assert.deepStrictEqual(stats.entriesByLevel, {});
            assert.deepStrictEqual(stats.entriesByComponent, {});
            assert.strictEqual(stats.oldestEntry, undefined);
            assert.strictEqual(stats.newestEntry, undefined);
        });
    });

    suite('log export', () => {
        test('should export logs as JSON', () => {
            logger.info('TestComponent', 'Test message', { test: 'data' });
            
            const exported = logger.exportLogs();
            const parsed = JSON.parse(exported);
            
            assert.ok(Array.isArray(parsed));
            assert.strictEqual(parsed.length, 1);
            assert.strictEqual(parsed[0].component, 'TestComponent');
            assert.strictEqual(parsed[0].message, 'Test message');
        });
    });

    suite('convenience functions', () => {
        test('should work with convenience functions', () => {
            log.debug('TestComponent', 'Debug via convenience');
            log.info('TestComponent', 'Info via convenience');
            log.warn('TestComponent', 'Warn via convenience');
            log.error('TestComponent', 'Error via convenience');
            
            const entries = logger.getRecentEntries();
            assert.strictEqual(entries.length, 4);
        });

        test('should provide convenience statistics', () => {
            log.info('TestComponent', 'Test message');
            
            const stats = log.getStats();
            assert.strictEqual(stats.totalEntries, 1);
        });
    });

    suite('error handling', () => {
        test('should handle logging errors gracefully', () => {
            // Test with circular reference data
            const circularData: any = { test: 'data' };
            circularData.circular = circularData;
            
            assert.doesNotThrow(() => {
                logger.info('TestComponent', 'Message with circular data', circularData);
            });
        });

        test('should handle invalid log levels', () => {
            assert.doesNotThrow(() => {
                logger.setLogLevel(-1 as LogLevel);
            });
        });
    });

    suite('singleton behavior', () => {
        test('should maintain singleton instance', () => {
            const instance1 = Logger.getInstance();
            const instance2 = Logger.getInstance();
            
            assert.strictEqual(instance1, instance2);
        });
    });
});