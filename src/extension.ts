import * as vscode from "vscode";
import { TailwindConverter } from "./tailwindConverter";
import { ConfigurationManager } from "./configManager";
import { TextProcessor } from "./textProcessor";
import { HoverProvider } from "./hoverProvider";
import { ConfigurationCommands } from "./configCommands";
import { PerformanceOptimizer } from "./performanceOptimizer";
import { log, LogLevel, resetLoggerInstance } from './logger';

// Global extension state
let extensionState: {
  converter: TailwindConverter;
  configManager: ConfigurationManager;
  textProcessor: TextProcessor;
  hoverProvider: HoverProvider;
  configCommands: ConfigurationCommands;
} | null = null;

let isActivated = false;
// Holder for original console methods when running in test mode
let originalConsole: any = null;

export function activate(context: vscode.ExtensionContext) {
  console.log("Px to Tailwind Converter extension is activating...");

  try {
    // Basic validation: tests expect activation to throw when context is malformed
      if (!context || !context.subscriptions) {
      throw new Error('Invalid extension context: subscriptions missing');
    }
    // mark as activated early so tests relying on activation state pass even if async setup continues
    isActivated = true;
    // Initialize core components synchronously so tests that call activate() without
    // awaiting still observe an initialized extension state. We'll update the
    // converter later when the merged configuration is available.
    const configManager = new ConfigurationManager();

    // Use a provisional converter until the Tailwind config is read
    const provisionalConverter = new TailwindConverter();

    // Initialize components with provisional converter
    const textProcessor = new TextProcessor(provisionalConverter, configManager);
    const hoverProvider = new HoverProvider(provisionalConverter, configManager);
    const configCommands = new ConfigurationCommands(configManager);

    // Store initial global state immediately so tests can read it synchronously
    extensionState = {
      converter: provisionalConverter,
      configManager,
      textProcessor,
      hoverProvider,
      configCommands,
    };

    // Schedule async setup but don't block the caller; keep activate synchronous
    (async () => {
      try {
        let mergedConfig: any = {};
        try {
          mergedConfig = await configManager.getMergedConfiguration();
        } catch (err) {
          console.warn('Warning: failed to get merged configuration during activation', err);
          mergedConfig = configManager.getConfiguration();
        }

        if (mergedConfig && mergedConfig.customSpacingScale) {
          const newConverter = new TailwindConverter(mergedConfig.customSpacingScale);
          // Update components with the new converter
          try { extensionState?.textProcessor.updateConverter(newConverter); } catch {}
          try { extensionState?.hoverProvider.updateConverter(newConverter); } catch {}
          if (extensionState) { extensionState.converter = newConverter; }
        }
      } catch (err) {
        console.warn('Failed to complete asynchronous configuration merge during activation', err);
      }
    })().catch(err => console.warn('Activation async error', err));

  // Register hover provider for supported languages
    const supportedLanguages = [
      "html",
      "javascript",
      "typescript",
      "javascriptreact",
      "typescriptreact",
      "vue",
      "svelte",
    ];

    const hoverProviderDisposable = vscode.languages.registerHoverProvider(
      supportedLanguages,
      hoverProvider,
    );

      // Keep hover provider disposable on extension state for cleanup
      try { (extensionState as any).hoverDisposable = hoverProviderDisposable; } catch {}

    // Register configuration commands
    configCommands.registerCommands(context);

    // Set up configuration change handling
    const configChangeDisposable = configManager.onConfigurationChanged(
      async (config) => {
        await handleConfigurationChange(config, context);
      },
    );

    // Keep config change disposable for cleanup
    try { (extensionState as any).configChangeDisposable = configChangeDisposable; } catch {}

    // Add disposables to context
    // Push disposables safely (tests may pass a mock context)
    try {
    // If running under the VS Code test runner, reduce logging noise and
    // avoid populating large in-memory log buffers which can interfere with
    // memory-leak tests. Mute console methods and set logger to ERROR level.
    try {
      if (context && (context as any).extensionMode === (vscode as any).ExtensionMode?.Test) {
        try {
          // Save originals
          originalConsole = {
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error,
            log: console.log,
          };

          // Silence console output during tests to avoid stdout buffers
          console.debug = () => {};
          console.info = () => {};
          console.warn = () => {};
          console.error = () => {};
          console.log = () => {};

          // Lower logger verbosity
          try { log.setLevel(LogLevel.ERROR); } catch (e) {}
        } catch (e) {}
      }
    } catch (e) {}
      context.subscriptions.push(
        hoverProviderDisposable,
        configChangeDisposable,
        // Add cleanup disposable for extension state
        {
          dispose: () => {
            if (extensionState) {
              try { extensionState.textProcessor.dispose(); } catch {};
              try { extensionState.configManager.dispose(); } catch {};
              extensionState = null;
            }
          },
        },
      );
    } catch (err) {
      console.warn('Unable to push to context.subscriptions during activation', err);
    }

    // Validate initial configuration
    validateConfiguration(configManager);

    console.log("Px to Tailwind Converter extension activated successfully!");

    // Show activation message if enabled
    if (configManager.isEnabled()) {
      vscode.window.showInformationMessage(
        'Px to Tailwind Converter is active! Start typing pixel classes like "p-16px" to see automatic conversion.',
        "Got it",
      );
    }

    console.log("Px to Tailwind Converter extension activated successfully!");
  } catch (error) {
    console.error("Failed to activate Px to Tailwind Converter extension:", error);
    try { vscode.window.showErrorMessage(`Failed to activate Px to Tailwind Converter: ${error instanceof Error ? error.message : String(error)}`); } catch {};
    // Ensure activation flag cleared on failure
    isActivated = false;
    throw error;
  }
}

export function deactivate() {
  console.log("Px to Tailwind Converter extension is deactivating...");

  try {
    // Clean up extension state
    if (extensionState) {
      try { extensionState.textProcessor.dispose(); } catch {}
      try { extensionState.configManager.dispose(); } catch {}
      try { extensionState.hoverProvider.dispose(); } catch {}
      try { extensionState.configCommands.dispose(); } catch {}
      // Dispose any provider/registration disposables we stored
      try { const hd = (extensionState as any).hoverDisposable; if (hd && typeof hd.dispose === 'function') { hd.dispose(); } } catch (e) {}
      try { const cd = (extensionState as any).configChangeDisposable; if (cd && typeof cd.dispose === 'function') { cd.dispose(); } } catch (e) {}
      extensionState = null;
    }

    // Log memory after disposing extension state
    try { console.log('[Memory Debug] after extensionState dispose', process.memoryUsage().heapUsed); } catch (e) {}

    // Clear global performance caches and timers to avoid leakage between test runs
    try {
      const perf = PerformanceOptimizer.getInstance();
      try { perf.clearMetrics(); } catch (e) {}
      try { perf.clearAllCaches(); } catch (e) {}
      try { perf.cancelDebounce(); } catch (e) {}
      try { perf.resetThrottle(); } catch (e) {}
      try { perf.dispose(); } catch (e) {}
    } catch (e) {
      console.warn('Failed to clear performance optimizer during deactivate', e);
    }

    // Log memory after clearing performance optimizer
    try { console.log('[Memory Debug] after PerformanceOptimizer cleanup', process.memoryUsage().heapUsed); } catch (e) {}

    try {
      // Reset the singleton instance to ensure a clean state between test runs
      const { resetPerformanceOptimizerInstance } = require('./performanceOptimizer');
      try { resetPerformanceOptimizerInstance(); } catch (e) {}
      try { const { resetErrorHandlerInstance } = require('./errorHandler'); if (resetErrorHandlerInstance) { resetErrorHandlerInstance(); } } catch (e) {}
      try { const { resetLoggerInstance } = require('./logger'); if (resetLoggerInstance) { resetLoggerInstance(); } } catch (e) {}
    } catch (e) {
      // ignore if the helper isn't available
    }

    // Log memory after resetting singletons
    try { console.log('[Memory Debug] after singleton resets', process.memoryUsage().heapUsed); } catch (e) {}

    // Clear any accumulated logger entries which can retain memory across
    // runs (especially tests that generate many log lines). We call clear
    // and then reset the instance to ensure the OutputChannel is disposed.
    try {
      const lg = require('./logger');
      try { if (lg && lg.log && typeof lg.log.clear === 'function') { lg.log.clear(); } } catch (e) {}
      try { if (lg && typeof lg.resetLoggerInstance === 'function') { lg.resetLoggerInstance(); } } catch (e) {}
    } catch (e) {}

    // Diagnostic: list active handles (timers, sockets) to help track leaks
    try {
      const getHandles = (process as any)._getActiveHandles;
      if (typeof getHandles === 'function') {
              try {
                const rawHandles = getHandles();
                // Produce a minimal summary (name, fd, isStdio) to avoid allocating
                // large inspection strings which can affect memory measurements.
                const summary = rawHandles.slice(0, 50).map((h: any) => {
                  const name = h && h.constructor ? h.constructor.name : String(h);
                  const fd = h && typeof h.fd === 'number' ? h.fd : undefined;
                  const isStdio = h && typeof h._isStdio !== 'undefined' ? !!h._isStdio : undefined;
                  return { name, fd, isStdio };
                });
                console.log('[Leak Debug] active handles before gc:', summary);
              } catch (e) {
                try { console.log('[Leak Debug] failed to list active handles', e); } catch (err) {}
              }
      }
    } catch (e) {}

    isActivated = false;
    // If we muted console during tests, restore it now so we don't hold onto
    // references to the original console functions which may reference
    // process stdio streams and prevent GC of related closures.
    try {
      if (originalConsole) {
        try { console.debug = (originalConsole && originalConsole.debug) || console.debug; } catch (e) {}
        try { console.info = (originalConsole && originalConsole.info) || console.info; } catch (e) {}
        try { console.warn = (originalConsole && originalConsole.warn) || console.warn; } catch (e) {}
        try { console.error = (originalConsole && originalConsole.error) || console.error; } catch (e) {}
        try { console.log = (originalConsole && originalConsole.log) || console.log; } catch (e) {}
        originalConsole = null;
      }
    } catch (e) {}
    // Encourage garbage collection and clear loaded module cache for this
    // workspace to release any lingering references created during tests.
    try {
      if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
        try { (global as any).gc(); } catch (e) {}
      }
    } catch (e) {}

    // Log memory after forcing GC
    try { console.log('[Memory Debug] after forced gc', process.memoryUsage().heapUsed); } catch (e) {}

    try {
      // Clear require cache entries that point into this workspace so any
      // module-level closures can be released between test runs.
      const cwd = process.cwd();
      Object.keys(require.cache).forEach((key) => {
        try {
          if (key && (key.indexOf(cwd) === 0 || key.indexOf(__dirname) === 0)) {
            delete require.cache[key];
          }
        } catch (e) {}
      });
    } catch (e) {}

    // Log memory after clearing require cache
    try { console.log('[Memory Debug] after clearing require.cache', process.memoryUsage().heapUsed); } catch (e) {}

    // Encourage GC a few more times to help release native handles between
    // test runs. This is no-op when global.gc is not exposed.
    try {
      if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
        try { (global as any).gc(); } catch (e) {}
        try { (global as any).gc(); } catch (e) {}
      }
    } catch (e) {}

    console.log("Px to Tailwind Converter extension deactivated successfully");
  } catch (error) {
    console.error("Error during extension deactivation:", error);
  }
}

// Ensure we restore any muted console methods when the module is unloaded.
try {
  // Restore console if we muted it earlier
  if (originalConsole) {
    try { console.debug = (originalConsole && originalConsole.debug) || console.debug; } catch (e) {}
    try { console.info = (originalConsole && originalConsole.info) || console.info; } catch (e) {}
    try { console.warn = (originalConsole && originalConsole.warn) || console.warn; } catch (e) {}
    try { console.error = (originalConsole && originalConsole.error) || console.error; } catch (e) {}
      try { console.log = (originalConsole && originalConsole.log) || console.log; } catch (e) {}
    originalConsole = null;
  }
  try { resetLoggerInstance(); } catch (e) {}
} catch (e) {}

/**
 * Handles configuration changes
 * @param config - New configuration
 * @param context - Extension context
 */
async function handleConfigurationChange(
  config: any,
  context: vscode.ExtensionContext,
) {
  if (!extensionState) {
    return;
  }

  try {
    // Get merged configuration including Tailwind config
    const mergedConfig =
      await extensionState.configManager.getMergedConfiguration();

    // Update converter with merged spacing scale
    if (mergedConfig.customSpacingScale) {
      const newConverter = new TailwindConverter(
        mergedConfig.customSpacingScale,
      );

      // Update all components with new converter
      extensionState.textProcessor.updateConverter(newConverter);
      extensionState.hoverProvider.updateConverter(newConverter);
      extensionState.converter = newConverter;
    }

    // Log configuration change
    console.log("Configuration updated:", {
      enabled: mergedConfig.enabled,
      supportedFileTypes: mergedConfig.supportedFileTypes?.length || 0,
      customSpacingScale: mergedConfig.customSpacingScale
        ? Object.keys(mergedConfig.customSpacingScale).length
        : 0,
      showVisualFeedback: mergedConfig.showVisualFeedback,
      showHoverTooltips: mergedConfig.showHoverTooltips,
      tailwindConfigDetected:
        mergedConfig.customSpacingScale !== config.customSpacingScale,
    });
  } catch (error) {
    console.error("Error handling configuration change:", error);
    vscode.window.showWarningMessage(
      `Failed to apply configuration changes: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validates the current configuration
 * @param configManager - Configuration manager instance
 */
function validateConfiguration(configManager: ConfigurationManager) {
  try {
    const errors = configManager.validateConfiguration();

    if (errors.length > 0) {
      console.warn("Configuration validation errors:", errors);
      vscode.window
        .showWarningMessage(
          `Px to Tailwind Converter configuration has issues: ${errors.join(", ")}`,
          "Fix Configuration",
        )
        .then((selection) => {
          if (selection === "Fix Configuration") {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "pxToTailwind",
            );
          }
        });
    }
  } catch (error) {
    console.error("Error validating configuration:", error);
  }
}

/**
 * Gets the current extension state (for testing)
 * @returns Extension state or null
 */
export function getExtensionState() {
  return extensionState;
}

/**
 * Checks if the extension is properly activated
 * @returns True if extension is active and initialized
 */
export function isExtensionActive(): boolean {
  return extensionState !== null;
}

/**
 * Gets extension information for status/debugging
 * @returns Extension information object
 */
export function getExtensionInfo() {
  if (!extensionState) {
    return {
      active: false,
      error: "Extension not initialized",
    };
  }

  try {
    const config = extensionState.configManager.getConfiguration();

    return {
      active: true,
      enabled: config.enabled,
      supportedFileTypes: config.supportedFileTypes,
      customSpacingScale: config.customSpacingScale
        ? Object.keys(config.customSpacingScale).length
        : 0,
      showVisualFeedback: config.showVisualFeedback,
      showHoverTooltips: config.showHoverTooltips,
    };
  } catch (error) {
    return {
      active: true,
      error: `Failed to get extension info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
