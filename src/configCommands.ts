import * as vscode from 'vscode';
import { ConfigurationManager } from './configManager';

export class ConfigurationCommands {
    private configManager: ConfigurationManager;
    private registeredDisposables: vscode.Disposable[] = [];

    constructor(configManager: ConfigurationManager) {
        this.configManager = configManager;
    }

    /**
     * Registers all configuration-related commands
     * @param context - Extension context
     */
    registerCommands(context: vscode.ExtensionContext): void {
        // Check if commands are already registered (for testing scenarios)
        try {
            // Toggle extension enabled/disabled
            const toggleCommand = vscode.commands.registerCommand(
                'pxToTailwind.toggle',
                () => this.toggleExtension()
            );

        // Reset configuration to defaults
        const resetCommand = vscode.commands.registerCommand(
            'pxToTailwind.resetConfig',
            () => this.resetConfiguration()
        );

        // Show current configuration
        const showConfigCommand = vscode.commands.registerCommand(
            'pxToTailwind.showConfig',
            () => this.showConfiguration()
        );

        // Validate configuration
        const validateCommand = vscode.commands.registerCommand(
            'pxToTailwind.validateConfig',
            () => this.validateConfiguration()
        );

        // Export configuration
        const exportCommand = vscode.commands.registerCommand(
            'pxToTailwind.exportConfig',
            () => this.exportConfiguration()
        );

            // Import configuration
            const importCommand = vscode.commands.registerCommand(
                'pxToTailwind.importConfig',
                () => this.importConfiguration()
            );

            // Keep track of disposables so tests can explicitly dispose them
            this.registeredDisposables.push(
                toggleCommand,
                resetCommand,
                showConfigCommand,
                validateCommand,
                exportCommand,
                importCommand
            );

            context.subscriptions.push(...this.registeredDisposables);
        } catch (error) {
            // Commands might already be registered (in testing scenarios)
            if (error instanceof Error && error.message.includes('already exists')) {
                console.warn('Commands already registered, skipping registration');
                return;
            }
            throw error;
        }
    }

    /**
     * Dispose any commands registered by this helper (used in tests/deactivate)
     */
    dispose(): void {
        try {
            this.registeredDisposables.forEach(d => {
                try { d.dispose(); } catch (e) {}
            });
        } finally {
            this.registeredDisposables = [];
        }
    }

    /**
     * Toggles the extension enabled/disabled state
     */
    private async toggleExtension(): Promise<void> {
        try {
            const currentState = this.configManager.isEnabled();
            await this.configManager.updateConfiguration('enabled', !currentState);
            
            const newState = !currentState ? 'enabled' : 'disabled';
            vscode.window.showInformationMessage(`Px to Tailwind Converter ${newState}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to toggle extension: ${error}`);
        }
    }

    /**
     * Resets configuration to defaults
     */
    private async resetConfiguration(): Promise<void> {
        const result = await vscode.window.showWarningMessage(
            'Reset Px to Tailwind Converter configuration to defaults?',
            { modal: true },
            'Reset',
            'Cancel'
        );

        if (result === 'Reset') {
            try {
                await this.configManager.resetToDefaults();
                vscode.window.showInformationMessage('Configuration reset to defaults');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to reset configuration: ${error}`);
            }
        }
    }

    /**
     * Shows current configuration in a new document
     */
    private async showConfiguration(): Promise<void> {
        try {
            const config = this.configManager.exportConfiguration();
            const doc = await vscode.workspace.openTextDocument({
                content: config,
                language: 'json'
            });
            
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show configuration: ${error}`);
        }
    }

    /**
     * Validates current configuration and shows results
     */
    private validateConfiguration(): void {
        try {
            const errors = this.configManager.validateConfiguration();
            
            if (errors.length === 0) {
                vscode.window.showInformationMessage('Configuration is valid');
            } else {
                const errorMessage = `Configuration errors:\n${errors.join('\n')}`;
                vscode.window.showErrorMessage(errorMessage);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to validate configuration: ${error}`);
        }
    }

    /**
     * Exports configuration to a file
     */
    private async exportConfiguration(): Promise<void> {
        try {
            const config = this.configManager.exportConfiguration();
            
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('px-to-tailwind-config.json'),
                filters: {
                    'JSON': ['json']
                }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(config, 'utf8'));
                vscode.window.showInformationMessage(`Configuration exported to ${uri.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export configuration: ${error}`);
        }
    }

    /**
     * Imports configuration from a file
     */
    private async importConfiguration(): Promise<void> {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JSON': ['json']
                }
            });

            if (uri && uri.length > 0) {
                const fileContent = await vscode.workspace.fs.readFile(uri[0]);
                const configJson = Buffer.from(fileContent).toString('utf8');
                
                // Ask for confirmation
                const result = await vscode.window.showWarningMessage(
                    'Import configuration? This will overwrite current settings.',
                    { modal: true },
                    'Import',
                    'Cancel'
                );

                if (result === 'Import') {
                    await this.configManager.importConfiguration(configJson);
                    vscode.window.showInformationMessage('Configuration imported successfully');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import configuration: ${error}`);
        }
    }
}