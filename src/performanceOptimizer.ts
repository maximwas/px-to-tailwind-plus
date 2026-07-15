import { log } from './logger';
import { handleError, ErrorSeverity } from './errorHandler';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
    operationName: string;
    startTime: number;
    endTime: number;
    duration: number;
    memoryBefore: number;
    memoryAfter: number;
    memoryDelta: number;
}

export class PerformanceOptimizer {
    private static instance: PerformanceOptimizer;
    private metrics: PerformanceMetrics[] = [];
    private readonly MAX_METRICS = 100;
    private caches: Map<string, Map<string, { value: any; timestamp: number; ttl: number }>> = new Map();
    private readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private throttleTimestamps: Map<string, number> = new Map();

    private constructor() {}

    static getInstance(): PerformanceOptimizer {
        if (!PerformanceOptimizer.instance) {
            PerformanceOptimizer.instance = new PerformanceOptimizer();
        }
        return PerformanceOptimizer.instance;
    }

    /**
     * Measures the performance of an operation
     * @param operationName - Name of the operation
     * @param operation - The operation to measure
     * @returns The result of the operation
     */
    async measureAsync<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
        const startTime = performance.now();
        const memoryBefore = process.memoryUsage().heapUsed;

        try {
            const result = await operation();
            
            const endTime = performance.now();
            const memoryAfter = process.memoryUsage().heapUsed;
            
            this.recordMetric({
                operationName,
                startTime,
                endTime,
                duration: endTime - startTime,
                memoryBefore,
                memoryAfter,
                memoryDelta: memoryAfter - memoryBefore
            });

            return result;
        } catch (error) {
            const endTime = performance.now();
            const memoryAfter = process.memoryUsage().heapUsed;
            
            this.recordMetric({
                operationName: `${operationName} (failed)`,
                startTime,
                endTime,
                duration: endTime - startTime,
                memoryBefore,
                memoryAfter,
                memoryDelta: memoryAfter - memoryBefore
            });

            throw error;
        }
    }

    /**
     * Measures the performance of a synchronous operation
     * @param operationName - Name of the operation
     * @param operation - The operation to measure
     * @returns The result of the operation
     */
    measureSync<T>(operationName: string, operation: () => T): T {
        const startTime = performance.now();
        const memoryBefore = process.memoryUsage().heapUsed;

        try {
            const result = operation();
            
            const endTime = performance.now();
            const memoryAfter = process.memoryUsage().heapUsed;
            
            this.recordMetric({
                operationName,
                startTime,
                endTime,
                duration: endTime - startTime,
                memoryBefore,
                memoryAfter,
                memoryDelta: memoryAfter - memoryBefore
            });

            return result;
        } catch (error) {
            const endTime = performance.now();
            const memoryAfter = process.memoryUsage().heapUsed;
            
            this.recordMetric({
                operationName: `${operationName} (failed)`,
                startTime,
                endTime,
                duration: endTime - startTime,
                memoryBefore,
                memoryAfter,
                memoryDelta: memoryAfter - memoryBefore
            });

            throw error;
        }
    }

    /**
     * Gets or sets a cached value
     * @param cacheKey - Cache category key
     * @param itemKey - Item key within the cache
     * @param valueFactory - Function to create the value if not cached
     * @param ttl - Time to live in milliseconds
     * @returns The cached or newly created value
     */
    async getCached<T>(
        cacheKey: string,
        itemKey: string,
        valueFactory: () => Promise<T>,
        ttl: number = this.DEFAULT_CACHE_TTL
    ): Promise<T> {
        return this.measureAsync(`cache-get-${cacheKey}`, async () => {
            // Get or create cache for this key
            if (!this.caches.has(cacheKey)) {
                this.caches.set(cacheKey, new Map());
            }
            
            const cache = this.caches.get(cacheKey)!;
            const now = Date.now();
            
            // Check if we have a valid cached value
            const cached = cache.get(itemKey);
            if (cached && (now - cached.timestamp) < cached.ttl) {
                log.debug('PerformanceOptimizer', `Cache hit for ${cacheKey}:${itemKey}`);
                return cached.value;
            }

            // Create new value
            log.debug('PerformanceOptimizer', `Cache miss for ${cacheKey}:${itemKey}, creating new value`);
            const value = await valueFactory();
            
            // Store in cache
            cache.set(itemKey, {
                value,
                timestamp: now,
                ttl
            });

            // Clean up expired entries periodically
            this.cleanupExpiredCache(cache);

            return value;
        });
    }

    /**
     * Gets or sets a cached value synchronously
     * @param cacheKey - Cache category key
     * @param itemKey - Item key within the cache
     * @param valueFactory - Function to create the value if not cached
     * @param ttl - Time to live in milliseconds
     * @returns The cached or newly created value
     */
    getCachedSync<T>(
        cacheKey: string,
        itemKey: string,
        valueFactory: () => T,
        ttl: number = this.DEFAULT_CACHE_TTL
    ): T {
        // Optimize the common cache-hit path by checking the cache first
        // and returning immediately if present. We only measure and record
        // metrics when we need to create the value (cache miss).
        // Get or create cache for this key
        if (!this.caches.has(cacheKey)) {
            this.caches.set(cacheKey, new Map());
        }

        const cache = this.caches.get(cacheKey)!;
        const now = Date.now();

        // Check if we have a valid cached value and return immediately
        const cached = cache.get(itemKey);
        if (cached && (now - cached.timestamp) < cached.ttl) {
            // Keep cache-hit path as lightweight as possible to avoid
            // polluting hot loops with logging overhead.
            return cached.value;
        }

        // Cache miss — measure creation and then store the result
        return this.measureSync(`cache-get-sync-${cacheKey}`, () => {
            log.debug('PerformanceOptimizer', `Cache miss for ${cacheKey}:${itemKey}, creating new value`);
            const value = valueFactory();

            // Store in cache
            cache.set(itemKey, {
                value,
                timestamp: Date.now(),
                ttl
            });

            // Clean up expired entries periodically
            this.cleanupExpiredCache(cache);

            return value;
        });
    }

    /**
     * Invalidates cache entries
     * @param cacheKey - Cache category key
     * @param itemKey - Optional specific item key to invalidate
     */
    invalidateCache(cacheKey: string, itemKey?: string): void {
        const cache = this.caches.get(cacheKey);
        if (!cache) {
            return;
        }

        if (itemKey) {
            cache.delete(itemKey);
            log.debug('PerformanceOptimizer', `Invalidated cache item ${cacheKey}:${itemKey}`);
        } else {
            cache.clear();
            log.debug('PerformanceOptimizer', `Cleared entire cache ${cacheKey}`);
        }
    }

    /**
     * Debounces a function call
     * @param key - Unique key for the debounced function
     * @param fn - Function to debounce
     * @param delay - Delay in milliseconds
     * @returns Debounced function
     */
    debounce<T extends (...args: any[]) => any>(
        key: string,
        fn: T,
        delay: number
    ): (...args: Parameters<T>) => void {
        return (...args: Parameters<T>) => {
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                fn(...args);
            }, delay);

            this.debounceTimers.set(key, timer);
        };
    }

    /**
     * Throttles a function call
     * @param key - Unique key for the throttled function
     * @param fn - Function to throttle
     * @param limit - Time limit in milliseconds
     * @returns Throttled function
     */
    throttle<T extends (...args: any[]) => any>(
        key: string,
        fn: T,
        limit: number
    ): (...args: Parameters<T>) => void {
        return (...args: Parameters<T>) => {
            const now = Date.now();
            const lastCall = this.throttleTimestamps.get(key) || 0;
            
            if (now - lastCall >= limit) {
                this.throttleTimestamps.set(key, now);
                fn(...args);
            }
        };
    }

    /**
     * Records a performance metric
     * @param metric - The metric to record
     */
    private recordMetric(metric: PerformanceMetrics): void {
        this.metrics.push(metric);
        
        // Keep only the most recent metrics
        if (this.metrics.length > this.MAX_METRICS) {
            this.metrics.shift();
        }

        // Log slow operations
        if (metric.duration > 100) {
            log.warn('PerformanceOptimizer', `Slow operation detected: ${metric.operationName}`, {
                duration: metric.duration,
                memoryDelta: metric.memoryDelta
            });
        }

        // Log high memory usage
        if (metric.memoryDelta > 10 * 1024 * 1024) { // 10MB
            log.warn('PerformanceOptimizer', `High memory usage detected: ${metric.operationName}`, {
                memoryDelta: metric.memoryDelta,
                duration: metric.duration
            });
        }
    }

    /**
     * Cleans up expired cache entries
     * @param cache - The cache to clean up
     */
    private cleanupExpiredCache(cache: Map<string, { value: any; timestamp: number; ttl: number }>): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of cache.entries()) {
            if (now - entry.timestamp >= entry.ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => cache.delete(key));

        if (keysToDelete.length > 0) {
            log.debug('PerformanceOptimizer', `Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }

    /**
     * Gets performance statistics
     * @returns Performance statistics
     */
    getPerformanceStats(): {
        totalOperations: number;
        averageDuration: number;
        slowestOperation: PerformanceMetrics | null;
        fastestOperation: PerformanceMetrics | null;
        totalMemoryDelta: number;
        cacheStats: { [key: string]: { size: number; hitRate?: number } };
    } {
        if (this.metrics.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                slowestOperation: null,
                fastestOperation: null,
                totalMemoryDelta: 0,
                cacheStats: {}
            };
        }

        const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
        const totalMemoryDelta = this.metrics.reduce((sum, m) => sum + m.memoryDelta, 0);
        
        const slowestOperation = this.metrics.reduce((slowest, current) => 
            current.duration > slowest.duration ? current : slowest
        );
        
        const fastestOperation = this.metrics.reduce((fastest, current) => 
            current.duration < fastest.duration ? current : fastest
        );

        const cacheStats: { [key: string]: { size: number } } = {};
        for (const [key, cache] of this.caches.entries()) {
            cacheStats[key] = { size: cache.size };
        }

        return {
            totalOperations: this.metrics.length,
            averageDuration: totalDuration / this.metrics.length,
            slowestOperation,
            fastestOperation,
            totalMemoryDelta,
            cacheStats
        };
    }

    /**
     * Clears all performance data
     */
    clearMetrics(): void {
        this.metrics = [];
        log.info('PerformanceOptimizer', 'Performance metrics cleared');
    }

    /**
     * Clears all caches
     */
    clearAllCaches(): void {
        this.caches.clear();
        log.info('PerformanceOptimizer', 'All caches cleared');
    }

    cancelDebounce(key?: string): void {
        if (key) {
            const timer = this.debounceTimers.get(key);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(key);
                log.debug('PerformanceOptimizer', `Cleared debounce timer ${key}`);
            }
            return;
        }

        for (const [timerKey, timer] of this.debounceTimers.entries()) {
            clearTimeout(timer);
            this.debounceTimers.delete(timerKey);
        }
        log.debug('PerformanceOptimizer', 'Cleared all debounce timers');
    }

    resetThrottle(key?: string): void {
        if (key) {
            this.throttleTimestamps.delete(key);
            return;
        }

        this.throttleTimestamps.clear();
    }

    /**
     * Gets memory usage information
     * @returns Memory usage statistics
     */
    getMemoryUsage(): {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
        heapUsedMB: number;
        heapTotalMB: number;
    } {
        const usage = process.memoryUsage();
        return {
            ...usage,
            heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
            heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100
        };
    }

    /**
     * Disposes of the performance optimizer
     */
    dispose(): void {
        // Clear all runtime state including metrics, caches and timers
        try { this.clearMetrics(); } catch (e) {}
        try { this.clearAllCaches(); } catch (e) {}
        try { this.cancelDebounce(); } catch (e) {}
        try { this.resetThrottle(); } catch (e) {}
    }
}

// Convenience functions for global performance optimization
export const measureAsync = <T>(name: string, operation: () => Promise<T>) =>
    PerformanceOptimizer.getInstance().measureAsync(name, operation);

export const measureSync = <T>(name: string, operation: () => T) =>
    PerformanceOptimizer.getInstance().measureSync(name, operation);

export const getCached = <T>(cacheKey: string, itemKey: string, factory: () => Promise<T>, ttl?: number) =>
    PerformanceOptimizer.getInstance().getCached(cacheKey, itemKey, factory, ttl);

export const getCachedSync = <T>(cacheKey: string, itemKey: string, factory: () => T, ttl?: number) =>
    PerformanceOptimizer.getInstance().getCachedSync(cacheKey, itemKey, factory, ttl);

export const invalidateCache = (cacheKey: string, itemKey?: string) =>
    PerformanceOptimizer.getInstance().invalidateCache(cacheKey, itemKey);

export const debounce = <T extends (...args: any[]) => any>(key: string, fn: T, delay: number) =>
    PerformanceOptimizer.getInstance().debounce(key, fn, delay);

export const throttle = <T extends (...args: any[]) => any>(key: string, fn: T, limit: number) =>
    PerformanceOptimizer.getInstance().throttle(key, fn, limit);

export const cancelDebounce = (key?: string) =>
    PerformanceOptimizer.getInstance().cancelDebounce(key);

export const resetThrottle = (key?: string) =>
    PerformanceOptimizer.getInstance().resetThrottle(key);

export const resetPerformanceOptimizerInstance = () => {
    try {
        // Dispose current instance state and replace the singleton
        PerformanceOptimizer.getInstance().dispose();
    } catch (e) {
        // ignore
    }
    // Clear the stored instance so a fresh one will be created on next getInstance()
    // @ts-ignore
    PerformanceOptimizer.instance = undefined;
};
