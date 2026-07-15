import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface TailwindConfig {
    theme?: {
        spacing?: Record<string, string>;
        extend?: {
            spacing?: Record<string, string>;
        };
        colors?: Record<string, string>;
        [key: string]: any;
    };
    [key: string]: any;
}

export class TailwindConfigReader {
    private configCache: Map<string, { config: TailwindConfig; timestamp: number }> = new Map();
    private readonly CACHE_DURATION = 30000; // 30 seconds
    private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private disposables: vscode.Disposable[] = [];

    /**
     * Reads Tailwind configuration from the workspace
     * @param workspaceFolder - Optional workspace folder to search in
     * @returns Tailwind configuration or null if not found
     */
    async readTailwindConfig(workspaceFolder?: vscode.WorkspaceFolder): Promise<TailwindConfig | null> {
        try {
            const configPath = await this.findTailwindConfigFile(workspaceFolder);
            if (!configPath) {
                return null;
            }

            // Check cache first
            const cached = this.getCachedConfig(configPath);
            if (cached) {
                return cached;
            }

            // Read and parse config file
            const config = await this.parseConfigFile(configPath);
            
            // Cache the result
            this.cacheConfig(configPath, config);
            
            // Set up file watcher if not already watching
            this.setupFileWatcher(configPath);

            return config;
        } catch (error) {
            console.error('Error reading Tailwind config:', error);
            return null;
        }
    }

    /**
     * Extracts spacing scale from Tailwind config
     * @param config - Tailwind configuration object
     * @returns Spacing scale mapping
     */
    extractSpacingScale(config: TailwindConfig): Record<string, number> | undefined {
        if (!config || !config.theme) {
            return undefined;
        }

        const spacingScale: Record<string, number> = {};

        // Process base spacing
        if (config.theme.spacing && typeof config.theme.spacing === 'object') {
            this.processSpacingObject(config.theme.spacing as any, spacingScale);
        }

        // Process extended spacing
        if (config.theme.extend && typeof config.theme.extend.spacing === 'object') {
            this.processSpacingObject(config.theme.extend!.spacing as any, spacingScale);
        }

        return Object.keys(spacingScale).length > 0 ? spacingScale : undefined;
    }

    /**
     * Finds Tailwind config file in workspace
     * @param workspaceFolder - Optional workspace folder to search in
     * @returns Path to config file or null if not found
     */
    private async findTailwindConfigFile(workspaceFolder?: vscode.WorkspaceFolder): Promise<string | null> {
        const possibleNames = [
            'tailwind.config.js',
            'tailwind.config.cjs',
            'tailwind.config.mjs',
            'tailwind.config.ts'
        ];

        // Determine search root
        let searchRoot: string;
        if (workspaceFolder) {
            searchRoot = workspaceFolder.uri.fsPath;
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            searchRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else {
            return null;
        }

        // Search for config files
        for (const fileName of possibleNames) {
            const configPath = path.join(searchRoot, fileName);
            
            try {
                await fs.promises.access(configPath, fs.constants.F_OK);
                return configPath;
            } catch {
                // File doesn't exist, continue searching
            }
        }

        return null;
    }

    /**
     * Parses Tailwind config file
     * @param configPath - Path to config file
     * @returns Parsed configuration
     */
    private async parseConfigFile(configPath: string): Promise<TailwindConfig> {
        const fileContent = await fs.promises.readFile(configPath, 'utf-8');
        
        // Handle different file types
        if (configPath.endsWith('.json')) {
            return JSON.parse(fileContent);
        }

        // For JS/TS files, we need to extract the configuration
        // This is a simplified parser - in a real implementation, you might want to use a more robust solution
        return this.parseJavaScriptConfig(fileContent);
    }

    /**
     * Parses JavaScript/TypeScript config file content
     * @param content - File content
     * @returns Parsed configuration
     */
    private parseJavaScriptConfig(content: string): TailwindConfig {
        try {
            // Remove comments and clean up the content
            const cleanContent = this.cleanJavaScriptContent(content);
            
            // Extract the configuration object
            const configMatch = cleanContent.match(/(?:module\.exports\s*=\s*|export\s+default\s+)(\{[\s\S]*\})/);
            if (!configMatch) {
                return {};
            }

            // Convert JavaScript object to JSON-parseable format
            const configString = this.convertToJSON(configMatch[1]);
            
            return JSON.parse(configString);
        } catch (error) {
            console.warn('Failed to parse Tailwind config file:', error);
            return {};
        }
    }

    /**
     * Cleans JavaScript content for parsing
     * @param content - Raw file content
     * @returns Cleaned content
     */
    private cleanJavaScriptContent(content: string): string {
        // Remove single-line comments
        content = content.replace(/\/\/.*$/gm, '');
        
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Remove imports and requires
        content = content.replace(/^(import|const|require).*$/gm, '');
        
        return content;
    }

    /**
     * Converts JavaScript object notation to JSON
     * @param jsObject - JavaScript object string
     * @returns JSON string
     */
    private convertToJSON(jsObject: string): string {
        // This is a simplified conversion - handles basic cases
        let jsonString = jsObject;
        
        // Convert unquoted keys to quoted keys
        jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
        
        // Convert single quotes to double quotes
        jsonString = jsonString.replace(/'/g, '"');
        
        // Remove trailing commas
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        
        // Handle functions and complex expressions by removing them
        jsonString = jsonString.replace(/:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\([^)]*\)[^,}]*/g, ': null');
        jsonString = jsonString.replace(/:\s*require\([^)]*\)[^,}]*/g, ': null');
        
        return jsonString;
    }

    /**
     * Processes spacing object and converts values to pixels
     * @param spacing - Spacing configuration object
     * @param result - Result object to populate
     */
    private processSpacingObject(spacing: Record<string, any>, result: Record<string, number>): void {
        for (const [key, value] of Object.entries(spacing || {})) {
            // Accept numeric or string values
            if (typeof value === 'number') {
                if (Number.isFinite(value) && value >= 0) {
                    result[key] = value;
                }
                continue;
            }

            const pixelValue = this.convertToPixels(String(value));
            if (pixelValue !== null) {
                result[key] = pixelValue;
            }
        }
    }

    /**
     * Converts CSS value to pixels
     * @param value - CSS value (e.g., "1rem", "16px", "1em")
     * @returns Pixel value or null if cannot convert
     */
    private convertToPixels(value: string): number | null {
        if (typeof value !== 'string') {
            return null;
        }

        // Handle pixel values
        const pxMatch = value.match(/^(\d+(?:\.\d+)?)px$/);
        if (pxMatch) {
            return parseFloat(pxMatch[1]);
        }

        // Handle rem values (assuming 1rem = 16px)
        const remMatch = value.match(/^(\d+(?:\.\d+)?)rem$/);
        if (remMatch) {
            return parseFloat(remMatch[1]) * 16;
        }

        // Handle em values (assuming 1em = 16px)
        const emMatch = value.match(/^(\d+(?:\.\d+)?)em$/);
        if (emMatch) {
            return parseFloat(emMatch[1]) * 16;
        }

        // Handle unitless values (treat as pixels)
        const numberMatch = value.match(/^(\d+(?:\.\d+)?)$/);
        if (numberMatch) {
            return parseFloat(numberMatch[1]);
        }

        return null;
    }

    /**
     * Gets cached configuration if still valid
     * @param configPath - Path to config file
     * @returns Cached config or null
     */
    private getCachedConfig(configPath: string): TailwindConfig | null {
        const cached = this.configCache.get(configPath);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_DURATION) {
            this.configCache.delete(configPath);
            return null;
        }

        return cached.config;
    }

    /**
     * Caches configuration
     * @param configPath - Path to config file
     * @param config - Configuration to cache
     */
    private cacheConfig(configPath: string, config: TailwindConfig): void {
        this.configCache.set(configPath, {
            config,
            timestamp: Date.now()
        });
    }

    /**
     * Sets up file watcher for config file
     * @param configPath - Path to config file
     */
    private setupFileWatcher(configPath: string): void {
        if (this.fileWatchers.has(configPath)) {
            return;
        }

        const watcher = vscode.workspace.createFileSystemWatcher(configPath);
        
        const onConfigChange = () => {
            // Clear cache when config changes
            this.configCache.delete(configPath);
            console.log('Tailwind config file changed, cache cleared');
        };

        watcher.onDidChange(onConfigChange);
        watcher.onDidDelete(onConfigChange);

        this.fileWatchers.set(configPath, watcher);
        this.disposables.push(watcher);
    }

    /**
     * Clears all caches
     */
    clearCache(): void {
        this.configCache.clear();
    }

    /**
     * Gets cache statistics
     * @returns Cache statistics
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.configCache.size,
            entries: Array.from(this.configCache.keys())
        };
    }

    /**
     * Disposes of all resources
     */
    dispose(): void {
        // Dispose of file watchers
        this.fileWatchers.forEach(watcher => watcher.dispose());
        this.fileWatchers.clear();

        // Dispose of other disposables
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];

        // Clear cache
        this.configCache.clear();
    }
}