import * as vscode from 'vscode';
import { ExtensionConfig } from './types';
import { TailwindConfigReader } from './tailwindConfigReader';

export class ConfigurationManager {
    private static readonly CONFIG_SECTION = 'pxToTailwind';
    private disposables: vscode.Disposable[] = [];
    private configChangeCallbacks: Array<(config: ExtensionConfig) => void> = [];
    private tailwindConfigReader: TailwindConfigReader;

    constructor() {
        this.tailwindConfigReader = new TailwindConfigReader();
        this.setupConfigurationWatcher();
    }

    /**
     * Gets the current extension configuration
     * @returns Current configuration object
     */
    getConfiguration(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        
        return {
            enabled: config.get<boolean>('enabled', true),
            supportedFileTypes: config.get<string[]>('supportedFileTypes', [
                'html',
                'javascript',
                'typescript',
                'javascriptreact',
                'typescriptreact',
                'vue',
                'svelte'
            ]),
            customSpacingScale: config.get<Record<string, number>>('customSpacingScale'),
            showVisualFeedback: config.get<boolean>('showVisualFeedback', true),
            showHoverTooltips: config.get<boolean>('showHoverTooltips', true)
        };
    }

    /**
     * Gets the merged configuration including Tailwind config file
     * @param workspaceFolder - Optional workspace folder
     * @returns Merged configuration with Tailwind config
     */
    async getMergedConfiguration(workspaceFolder?: vscode.WorkspaceFolder): Promise<ExtensionConfig> {
        const baseConfig = this.getConfiguration();
        
        try {
            // Read Tailwind config file
            const tailwindConfig = await this.tailwindConfigReader.readTailwindConfig(workspaceFolder);
            
            if (tailwindConfig) {
                // Extract spacing scale from Tailwind config
                const tailwindSpacing = this.tailwindConfigReader.extractSpacingScale(tailwindConfig);
                
                if (tailwindSpacing) {
                    // Merge with VS Code configuration (VS Code config takes precedence)
                    const mergedSpacing = {
                        ...tailwindSpacing,
                        ...baseConfig.customSpacingScale
                    };
                    
                    return {
                        ...baseConfig,
                        customSpacingScale: mergedSpacing
                    };
                }
            }
        } catch (error) {
            console.warn('Failed to read Tailwind config:', error);
        }
        
        return baseConfig;
    }

    /**
     * Updates a specific configuration value
     * @param key - Configuration key to update
     * @param value - New value
     * @param target - Configuration target (global, workspace, etc.)
     */
    async updateConfiguration<K extends keyof ExtensionConfig>(
        key: K,
        value: ExtensionConfig[K],
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        
        try {
            await config.update(key, value, target);
        } catch (error) {
            console.error(`Failed to update configuration ${key}:`, error);
            throw new Error(`Failed to update configuration: ${error}`);
        }
    }

    /**
     * Checks if the extension is enabled
     * @returns True if extension is enabled
     */
    isEnabled(): boolean {
        return this.getConfiguration().enabled;
    }

    /**
     * Checks if a file type is supported
     * @param languageId - VS Code language ID
     * @returns True if file type is supported
     */
    isSupportedFileType(languageId: string): boolean {
        const config = this.getConfiguration();
        return config.supportedFileTypes.includes(languageId);
    }

    /**
     * Gets the custom spacing scale if configured
     * @returns Custom spacing scale or undefined
     */
    getCustomSpacingScale(): Record<string, number> | undefined {
        return this.getConfiguration().customSpacingScale;
    }

    /**
     * Checks if visual feedback is enabled
     * @returns True if visual feedback should be shown
     */
    shouldShowVisualFeedback(): boolean {
        return this.getConfiguration().showVisualFeedback;
    }

    /**
     * Checks if hover tooltips are enabled
     * @returns True if hover tooltips should be shown
     */
    shouldShowHoverTooltips(): boolean {
        return this.getConfiguration().showHoverTooltips;
    }

    /**
     * Registers a callback for configuration changes
     * @param callback - Function to call when configuration changes
     * @returns Disposable to unregister the callback
     */
    onConfigurationChanged(callback: (config: ExtensionConfig) => void): vscode.Disposable {
        this.configChangeCallbacks.push(callback);
        
        return {
            dispose: () => {
                const index = this.configChangeCallbacks.indexOf(callback);
                if (index > -1) {
                    this.configChangeCallbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Sets up configuration change watcher
     */
    private setupConfigurationWatcher(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(ConfigurationManager.CONFIG_SECTION)) {
                this.handleConfigurationChange();
            }
        });
        
        this.disposables.push(configWatcher);
    }

    /**
     * Handles configuration changes
     */
    private handleConfigurationChange(): void {
        const newConfig = this.getConfiguration();
        
        // Notify all registered callbacks
        this.configChangeCallbacks.forEach(callback => {
            try {
                callback(newConfig);
            } catch (error) {
                console.error('Error in configuration change callback:', error);
            }
        });
    }

    /**
     * Validates the current configuration
     * @returns Array of validation errors (empty if valid)
     */
    validateConfiguration(configToValidate?: ExtensionConfig): string[] {
        const config = configToValidate ?? this.getConfiguration();
        const errors: string[] = [];

        // Validate supported file types
        if (!Array.isArray(config.supportedFileTypes)) {
            errors.push('supportedFileTypes must be an array');
        } else if (config.supportedFileTypes.length === 0) {
            errors.push('supportedFileTypes cannot be empty');
        } else {
            const validLanguageIds = [
                'html', 'javascript', 'typescript', 'javascriptreact', 
                'typescriptreact', 'vue', 'svelte', 'php', 'erb', 'handlebars'
            ];
            
            const invalidTypes = config.supportedFileTypes.filter(
                type => !validLanguageIds.includes(type)
            );
            
            if (invalidTypes.length > 0) {
                errors.push(`Invalid file types: ${invalidTypes.join(', ')}`);
            }
        }

        // Validate custom spacing scale
        if (config.customSpacingScale !== undefined) {
            if (typeof config.customSpacingScale !== 'object' || config.customSpacingScale === null) {
                errors.push('customSpacingScale must be an object');
            } else {
                for (const [key, value] of Object.entries(config.customSpacingScale)) {
                    if (typeof key !== 'string' || key.trim() === '') {
                        errors.push(`Invalid spacing scale key: ${key}`);
                    }
                    
                    if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
                        errors.push(`Invalid spacing scale value for ${key}: ${value} (must be a non-negative number)`);
                    }
                }
            }
        }

        // Validate boolean settings
        if (typeof config.enabled !== 'boolean') {
            errors.push('enabled must be a boolean');
        }
        
        if (typeof config.showVisualFeedback !== 'boolean') {
            errors.push('showVisualFeedback must be a boolean');
        }
        
        if (typeof config.showHoverTooltips !== 'boolean') {
            errors.push('showHoverTooltips must be a boolean');
        }

        return errors;
    }

    /**
     * Resets configuration to defaults
     * @param target - Configuration target
     */
    async resetToDefaults(target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
        
        try {
            await Promise.all([
                config.update('enabled', undefined, target),
                config.update('supportedFileTypes', undefined, target),
                config.update('customSpacingScale', undefined, target),
                config.update('showVisualFeedback', undefined, target),
                config.update('showHoverTooltips', undefined, target)
            ]);
        } catch (error) {
            console.error('Failed to reset configuration:', error);
            throw new Error(`Failed to reset configuration: ${error}`);
        }
    }

    /**
     * Gets configuration for a specific workspace folder
     * @param workspaceFolder - Workspace folder to get config for
     * @returns Configuration for the workspace folder
     */
    getWorkspaceFolderConfiguration(workspaceFolder: vscode.WorkspaceFolder): ExtensionConfig {
        const config = vscode.workspace.getConfiguration(
            ConfigurationManager.CONFIG_SECTION,
            workspaceFolder.uri
        );
        
        return {
            enabled: config.get<boolean>('enabled', true),
            supportedFileTypes: config.get<string[]>('supportedFileTypes', [
                'html',
                'javascript',
                'typescript',
                'javascriptreact',
                'typescriptreact',
                'vue',
                'svelte'
            ]),
            customSpacingScale: config.get<Record<string, number>>('customSpacingScale'),
            showVisualFeedback: config.get<boolean>('showVisualFeedback', true),
            showHoverTooltips: config.get<boolean>('showHoverTooltips', true)
        };
    }

    /**
     * Exports current configuration as JSON
     * @returns Configuration as JSON string
     */
    exportConfiguration(): string {
        const config = this.getConfiguration();
        return JSON.stringify(config, null, 2);
    }

    /**
     * Imports configuration from JSON
     * @param jsonConfig - Configuration as JSON string
     * @param target - Configuration target
     */
    async importConfiguration(
        jsonConfig: string,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        try {
            const config = JSON.parse(jsonConfig) as Partial<ExtensionConfig>;
            
            // Validate imported configuration
            const tempConfig = { ...this.getConfiguration(), ...config } as ExtensionConfig;
            const errors = this.validateConfiguration(tempConfig);
            
            if (errors.length > 0) {
                throw new Error(`Invalid configuration: ${errors.join(', ')}`);
            }

            // Apply configuration
            const vsConfig = vscode.workspace.getConfiguration(ConfigurationManager.CONFIG_SECTION);
            
            await Promise.all([
                config.enabled !== undefined ? vsConfig.update('enabled', config.enabled, target) : Promise.resolve(),
                config.supportedFileTypes !== undefined ? vsConfig.update('supportedFileTypes', config.supportedFileTypes, target) : Promise.resolve(),
                config.customSpacingScale !== undefined ? vsConfig.update('customSpacingScale', config.customSpacingScale, target) : Promise.resolve(),
                config.showVisualFeedback !== undefined ? vsConfig.update('showVisualFeedback', config.showVisualFeedback, target) : Promise.resolve(),
                config.showHoverTooltips !== undefined ? vsConfig.update('showHoverTooltips', config.showHoverTooltips, target) : Promise.resolve()
            ]);
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw new Error(`Failed to import configuration: ${error}`);
        }
    }

    /**
     * Gets the configuration section name
     * @returns Configuration section name
     */
    static getConfigurationSection(): string {
        return ConfigurationManager.CONFIG_SECTION;
    }

    /**
     * Gets the Tailwind config reader instance
     * @returns Tailwind config reader
     */
    getTailwindConfigReader(): TailwindConfigReader {
        return this.tailwindConfigReader;
    }

    /**
     * Refreshes Tailwind configuration cache
     */
    async refreshTailwindConfig(): Promise<void> {
        this.tailwindConfigReader.clearCache();
        
        // Trigger configuration change to update components
        const newConfig = await this.getMergedConfiguration();
        this.configChangeCallbacks.forEach(callback => {
            try {
                callback(newConfig);
            } catch (error) {
                console.error('Error in configuration change callback:', error);
            }
        });
    }

    /**
     * Disposes of all event listeners
     */
    dispose(): void {
        this.tailwindConfigReader.dispose();
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.configChangeCallbacks = [];
    }
}
