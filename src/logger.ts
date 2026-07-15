import * as vscode from "vscode";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel = LogLevel.DEBUG;
  private logEntries: LogEntry[] = [];
  private readonly MAX_LOG_ENTRIES = 1000;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      "Px to Tailwind Converter",
    );
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Sets the logging level
   * @param level - Minimum log level to output
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info("Logger", `Log level set to ${LogLevel[level]}`);
  }

  /**
   * Gets the current log level
   * @returns Current log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Logs a debug message
   * @param component - Component name
   * @param message - Log message
   * @param data - Optional data to log
   */
  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  /**
   * Logs an info message
   * @param component - Component name
   * @param message - Log message
   * @param data - Optional data to log
   */
  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  /**
   * Logs a warning message
   * @param component - Component name
   * @param message - Log message
   * @param data - Optional data to log
   */
  warn(component: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  /**
   * Logs an error message
   * @param component - Component name
   * @param message - Log message
   * @param error - Error object
   * @param data - Optional additional data
   */
  error(component: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, component, message, data, error);
  }

  /**
   * Logs a message with specified level
   * @param level - Log level
   * @param component - Component name
   * @param message - Log message
   * @param data - Optional data to log
   * @param error - Optional error object
   */
  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error,
  ): void {
    if (level < this.logLevel) {
      return;
    }

    const timestamp = new Date();
    const logEntry: LogEntry = {
      timestamp,
      level,
      component,
      message,
      data,
      error,
    };

    // Add to log entries
    this.logEntries.push(logEntry);

    // Maintain max entries limit
    if (this.logEntries.length > this.MAX_LOG_ENTRIES) {
      this.logEntries.shift();
    }

    // Format and output log message
    const formattedMessage = this.formatLogMessage(logEntry);
    this.outputChannel.appendLine(formattedMessage);

    // Also log to console for development
    this.logToConsole(logEntry);
  }

  /**
   * Formats a log message for output
   * @param entry - Log entry to format
   * @returns Formatted log message
   */
  private formatLogMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const component = entry.component.padEnd(20);

    let message = `[${timestamp}] ${level} ${component} ${entry.message}`;

    if (entry.data) {
      try {
        // Safe stringify to avoid circular errors
        const seen = new WeakSet();
        const safeStringify = (obj: any) => JSON.stringify(obj, function (_k, v) {
          if (typeof v === 'object' && v !== null) {
            if (seen.has(v)) {return '[Circular]';}
            seen.add(v);
          }
          return v;
        }, 2);

        message += `\n  Data: ${safeStringify(entry.data)}`;
      } catch (e) {
        message += `\n  Data: [Unable to stringify data]`;
      }
    }

    if (entry.error) {
      try {
        message += `\n  Error: ${entry.error && entry.error.message ? entry.error.message : String(entry.error)}`;
        if (entry.error && entry.error.stack) {
          message += `\n  Stack: ${entry.error.stack}`;
        }
      } catch (e) {
        message += `\n  Error: [Unable to stringify error]`;
      }
    }

    return message;
  }

  /**
   * Logs to console for development
   * @param entry - Log entry
   */
  private logToConsole(entry: LogEntry): void {
    const message = `[${entry.component}] ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data, entry.error);
        break;
      case LogLevel.ERROR:
        console.error(message, entry.error, entry.data);
        break;
    }
  }

  /**
   * Shows the output channel
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Clears the output channel and log entries
   */
  clear(): void {
    this.outputChannel.clear();
    this.logEntries = [];
    // Reset log level to default so tests and new consumers start from a known state
    this.logLevel = LogLevel.DEBUG;
  }

  /**
   * Gets recent log entries
   * @param count - Number of entries to return
   * @returns Recent log entries
   */
  getRecentEntries(count: number = 50): LogEntry[] {
    return this.logEntries.slice(-count);
  }

  /**
   * Gets log entries by level
   * @param level - Log level to filter by
   * @returns Log entries of specified level
   */
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.logEntries.filter((entry) => entry.level === level);
  }

  /**
   * Gets log entries by component
   * @param component - Component name to filter by
   * @returns Log entries from specified component
   */
  getEntriesByComponent(component: string): LogEntry[] {
    return this.logEntries.filter((entry) => entry.component === component);
  }

  /**
   * Exports logs as JSON
   * @returns JSON string of all log entries
   */
  exportLogs(): string {
    return JSON.stringify(this.logEntries, null, 2);
  }

  /**
   * Gets logging statistics
   * @returns Logging statistics
   */
  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    entriesByComponent: Record<string, number>;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entriesByLevel: Record<string, number> = {};
    const entriesByComponent: Record<string, number> = {};

    this.logEntries.forEach((entry) => {
      const levelName = LogLevel[entry.level];
      entriesByLevel[levelName] = (entriesByLevel[levelName] || 0) + 1;
      entriesByComponent[entry.component] =
        (entriesByComponent[entry.component] || 0) + 1;
    });

    return {
      totalEntries: this.logEntries.length,
      entriesByLevel,
      entriesByComponent,
      oldestEntry:
        this.logEntries.length > 0 ? this.logEntries[0].timestamp : undefined,
      newestEntry:
        this.logEntries.length > 0
          ? this.logEntries[this.logEntries.length - 1].timestamp
          : undefined,
    };
  }

  /**
   * Disposes of the logger
   */
  dispose(): void {
    this.outputChannel.dispose();
    this.logEntries = [];
  }
}

// Convenience functions for global logging
export const log = {
  debug: (component: string, message: string, data?: any) =>
    Logger.getInstance().debug(component, message, data),
  info: (component: string, message: string, data?: any) =>
    Logger.getInstance().info(component, message, data),
  warn: (component: string, message: string, data?: any) =>
    Logger.getInstance().warn(component, message, data),
  error: (component: string, message: string, error?: Error, data?: any) =>
    Logger.getInstance().error(component, message, error, data),
  setLevel: (level: LogLevel) => Logger.getInstance().setLogLevel(level),
  show: () => Logger.getInstance().show(),
  clear: () => Logger.getInstance().clear(),
  getStats: () => Logger.getInstance().getStats(),
  exportLogs: () => Logger.getInstance().exportLogs(),
};

export const resetLoggerInstance = () => {
  try {
    Logger.getInstance().dispose();
  } catch (e) {}
  // @ts-ignore
  Logger.instance = undefined;
};
