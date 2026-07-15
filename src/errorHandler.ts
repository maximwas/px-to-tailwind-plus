import * as vscode from 'vscode';
import { log } from './logger';

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export interface ErrorContext {
    component: string;
    operation: string;
    data?: any;
    userMessage?: string;
    severity?: ErrorSeverity;
    showToUser?: boolean;
    suggestedAction?: string;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorCounts: Map<string, number> = new Map();
    private readonly MAX_ERROR_COUNT = 10;
    private readonly ERROR_RESET_INTERVAL = 300000; // 5 minutes
    private testMode: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;

    private constructor() {
        // Reset error counts periodically
        this.intervalId = setInterval(() => {
            this.errorCounts.clear();
        }, this.ERROR_RESET_INTERVAL);
    }

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Enables test mode to disable user dialogs during testing
     */
    setTestMode(enabled: boolean): void {
        this.testMode = enabled;
    }

    /**
     * Handles an error with comprehensive logging and user feedback
     * @param error - The error that occurred
     * @param context - Error context information
     * @returns Promise that resolves when error handling is complete
     */
    async handleError(error: any, context: ErrorContext): Promise<void> {
        // tolerate null/undefined errors and non-Error values
        const safeError = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));

        const errorKey = `${context.component}:${context.operation}`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        
        // Increment error count
        this.errorCounts.set(errorKey, errorCount + 1);

        // Log the error (use safeError.message)
        log.error(context.component, `Error in ${context.operation}: ${safeError.message}`, safeError, {
            operation: context.operation,
            data: context.data,
            severity: context.severity || ErrorSeverity.MEDIUM,
            errorCount: errorCount + 1
        });

        // Determine if we should show this error to the user
        const shouldShowToUser = this.shouldShowErrorToUser(error, context, errorCount + 1);

        if (shouldShowToUser) {
            await this.showErrorToUser(error, context);
        }

        // Handle critical errors
        if (context.severity === ErrorSeverity.CRITICAL) {
            await this.handleCriticalError(error, context);
        }

        // Collect error telemetry (if enabled)
        this.collectErrorTelemetry(safeError, context);
    }

    /**
     * Handles expected errors that don't need full error handling
     * @param error - The expected error
     * @param context - Error context
     */
    handleExpectedError(error: Error, context: ErrorContext): void {
        log.warn(context.component, `Expected error in ${context.operation}: ${error.message}`, {
            operation: context.operation,
            data: context.data
        });
    }

    /**
     * Wraps an async operation with error handling
     * @param operation - The operation to wrap
     * @param context - Error context
     * @returns Promise with error handling
     */
    async wrapAsync<T>(
        operation: () => Promise<T>,
        context: ErrorContext
    ): Promise<T | null> {
        try {
            log.debug(context.component, `Starting ${context.operation}`, context.data);
            const result = await operation();
            log.debug(context.component, `Completed ${context.operation}`, { success: true });
            return result;
        } catch (error) {
            await this.handleError(error as Error, context);
            return null;
        }
    }

    /**
     * Wraps a synchronous operation with error handling
     * @param operation - The operation to wrap
     * @param context - Error context
     * @returns Result with error handling
     */
    wrapSync<T>(
        operation: () => T,
        context: ErrorContext
    ): T | null {
        try {
            log.debug(context.component, `Starting ${context.operation}`, context.data);
            const result = operation();
            log.debug(context.component, `Completed ${context.operation}`, { success: true });
            return result;
        } catch (error) {
            // Handle sync errors without await
            this.handleError(error as Error, context).catch(err => {
                console.error('Error in error handler:', err);
            });
            return null;
        }
    }

    /**
     * Determines if an error should be shown to the user
     * @param error - The error
     * @param context - Error context
     * @param errorCount - Number of times this error has occurred
     * @returns True if error should be shown to user
     */
    private shouldShowErrorToUser(error: Error, context: ErrorContext, errorCount: number): boolean {
        // Always show critical errors
        if (context.severity === ErrorSeverity.CRITICAL) {
            return true;
        }

        // Don't show if explicitly disabled
        if (context.showToUser === false) {
            return false;
        }

        // Don't show if we've shown this error too many times
        if (errorCount > this.MAX_ERROR_COUNT) {
            return false;
        }

        // Show high severity errors
        if (context.severity === ErrorSeverity.HIGH) {
            return true;
        }

        // Show medium severity errors less frequently
        if (context.severity === ErrorSeverity.MEDIUM) {
            return errorCount <= 3;
        }

        // Show low severity errors only once
        if (context.severity === ErrorSeverity.LOW) {
            return errorCount === 1;
        }

        // Default: show if explicitly requested or for first occurrence
        return context.showToUser === true || errorCount === 1;
    }

    /**
     * Shows an error message to the user
     * @param error - The error
     * @param context - Error context
     */
    private async showErrorToUser(error: any, context: ErrorContext): Promise<void> {
        // Skip user dialogs in test mode
        if (this.testMode) {
            return;
        }

        const safeError = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
        const userMessage = context.userMessage || `An error occurred in ${context.component}`;
        const fullMessage = `${userMessage}: ${safeError.message}`;

        const actions: string[] = [];
        
        if (context.suggestedAction) {
            actions.push(context.suggestedAction);
        }
        
        actions.push('Show Logs', 'Report Issue');

        let selectedAction: string | undefined;

        switch (context.severity) {
            case ErrorSeverity.CRITICAL:
                selectedAction = await vscode.window.showErrorMessage(fullMessage, ...actions);
                break;
            case ErrorSeverity.HIGH:
                selectedAction = await vscode.window.showErrorMessage(fullMessage, ...actions);
                break;
            case ErrorSeverity.MEDIUM:
                selectedAction = await vscode.window.showWarningMessage(fullMessage, ...actions);
                break;
            case ErrorSeverity.LOW:
                selectedAction = await vscode.window.showInformationMessage(fullMessage, ...actions);
                break;
            default:
                selectedAction = await vscode.window.showWarningMessage(fullMessage, ...actions);
        }

        // Handle user action
        if (selectedAction) {
            await this.handleUserAction(selectedAction, error, context);
        }
    }

    /**
     * Handles user actions from error messages
     * @param action - The selected action
     * @param error - The original error
     * @param context - Error context
     */
    private async handleUserAction(action: string, error: Error, context: ErrorContext): Promise<void> {
        switch (action) {
            case 'Show Logs':
                log.show();
                break;
            
            case 'Report Issue':
                await this.openIssueReporter(error, context);
                break;
            
            case 'Reload Extension':
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
                break;
            
            case 'Open Settings':
                await vscode.commands.executeCommand('workbench.action.openSettings', 'pxToTailwind');
                break;
            
            default:
                // Handle custom suggested actions
                if (context.suggestedAction === action) {
                    log.info('ErrorHandler', `User selected suggested action: ${action}`);
                }
        }
    }

    /**
     * Handles critical errors that may require extension restart
     * @param error - The critical error
     * @param context - Error context
     */
    private async handleCriticalError(error: Error, context: ErrorContext): Promise<void> {
        log.error('ErrorHandler', 'Critical error detected', error, {
            component: context.component,
            operation: context.operation,
            data: context.data
        });

        // Skip user dialogs in test mode
        if (this.testMode) {
            return;
        }

        // For critical errors, offer to reload the extension
        const action = await vscode.window.showErrorMessage(
            `Critical error in Px to Tailwind Converter: ${error.message}`,
            'Reload Extension',
            'Show Logs',
            'Report Issue'
        );

        if (action === 'Reload Extension') {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else if (action === 'Show Logs') {
            log.show();
        } else if (action === 'Report Issue') {
            await this.openIssueReporter(error, context);
        }
    }

    /**
     * Opens the issue reporter with error details
     * @param error - The error to report
     * @param context - Error context
     */
    private async openIssueReporter(error: Error, context: ErrorContext): Promise<void> {
        const errorDetails: any = {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            component: context.component,
            operation: context.operation,
            data: context.data,
            timestamp: new Date().toISOString(),
            vscodeVersion: vscode.version,
            extensionVersion: vscode.extensions.getExtension('px-to-tailwind-converter')?.packageJSON?.version
        };

        // Safely stringify to avoid issues with circular structures
        const safeStringify = (obj: any) => {
            const seen = new WeakSet();
            return JSON.stringify(obj, function (_key, value) {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular]';
                    }
                    seen.add(value);
                }
                return value;
            }, 2);
        };

        const issueBody = [
            '## Error Report',
            '',
            `**Error Message:** ${errorDetails.error}`,
            '',
            `**Component:** ${context.component}`,
            '',
            `**Operation:** ${context.operation}`,
            '',
            `**Timestamp:** ${errorDetails.timestamp}`,
            '',
            `**VS Code Version:** ${errorDetails.vscodeVersion}`,
            '',
            `**Extension Version:** ${errorDetails.extensionVersion}`,
            '',
            '**Error Details:**',
            '```json',
            safeStringify(errorDetails),
            '```',
            '',
            '**Steps to Reproduce:**',
            '1.',
            '2.',
            '3.',
            '',
            '**Expected Behavior:**',
            '',
            '**Additional Context:**',
            ''
        ].join('\n');

        const issueUrl = `https://github.com/your-repo/px-to-tailwind-converter/issues/new?body=${encodeURIComponent(issueBody)}`;
        await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }

    /**
     * Collects error telemetry (placeholder for future implementation)
     * @param error - The error
     * @param context - Error context
     */
    private collectErrorTelemetry(error: Error, context: ErrorContext): void {
        // Placeholder for telemetry collection
        // In a real implementation, you might send anonymized error data
        // to help improve the extension
        let errorType = 'Unknown';
        try {
            errorType = (error && (error as any).constructor && (error as any).constructor.name) || String(error);
        } catch (e) {
            errorType = String(error);
        }

        log.debug('ErrorHandler', 'Error telemetry collected', {
            errorType,
            component: context.component,
            operation: context.operation,
            severity: context.severity
        });
    }

    /**
     * Gets error statistics
     * @returns Error statistics
     */
    getErrorStats(): {
        totalErrors: number;
        errorsByComponent: Record<string, number>;
        recentErrors: Array<{ key: string; count: number }>;
    } {
        const errorsByComponent: Record<string, number> = {};
        const recentErrors: Array<{ key: string; count: number }> = [];

        for (const [key, count] of this.errorCounts.entries()) {
            const [component] = key.split(':');
            errorsByComponent[component] = (errorsByComponent[component] || 0) + count;
            recentErrors.push({ key, count });
        }

        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
            errorsByComponent,
            recentErrors: recentErrors.sort((a, b) => b.count - a.count)
        };
    }

    /**
     * Clears error counts
     */
    clearErrorCounts(): void {
        this.errorCounts.clear();
        log.info('ErrorHandler', 'Error counts cleared');
    }

    /**
     * Disposes of the ErrorHandler and clears timers
     */
    dispose(): void {
        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        } catch (e) {}

        this.errorCounts.clear();
        this.testMode = false;
    }
}

// Convenience functions for global error handling
export const handleError = (error: Error, context: ErrorContext) => ErrorHandler.getInstance().handleError(error, context);
export const handleExpectedError = (error: Error, context: ErrorContext) => ErrorHandler.getInstance().handleExpectedError(error, context);
export const wrapAsync = <T>(operation: () => Promise<T>, context: ErrorContext) => ErrorHandler.getInstance().wrapAsync(operation, context);
export const wrapSync = <T>(operation: () => T, context: ErrorContext) => ErrorHandler.getInstance().wrapSync(operation, context);

export const resetErrorHandlerInstance = () => {
    try {
        ErrorHandler.getInstance().dispose();
    } catch (e) {}
    // @ts-ignore
    ErrorHandler.instance = undefined;
};