import * as vscode from 'vscode';
import { PixelClassMatch } from './types';

export class ReplacementHandler {
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 100; // ms

    /**
     * Applies text replacements using VS Code's WorkspaceEdit API
     * @param document - The document to modify
     * @param matches - The pixel class matches to replace
     * @returns Promise that resolves to true if successful
     */
    async applyReplacements(
        document: vscode.TextDocument,
        matches: PixelClassMatch[]
    ): Promise<boolean> {
        if (matches.length === 0) {
            return true;
        }

        // Validate all matches before applying
        const validMatches = this.validateMatches(document, matches);
        if (validMatches.length === 0) {
            return true;
        }

        // Create workspace edit
        const edit = this.createWorkspaceEdit(document, validMatches);

        // Apply with retry logic
        return this.applyEditWithRetry(edit);
    }

    /**
     * Applies multiple replacements in a single operation
     * @param document - The document to modify
     * @param matches - Array of pixel class matches
     * @returns Promise that resolves to true if successful
     */
    async applyBatchReplacements(
        document: vscode.TextDocument,
        matches: PixelClassMatch[]
    ): Promise<boolean> {
        if (matches.length === 0) {
            return true;
        }

        // Group matches by line for better performance
        const groupedMatches = this.groupMatchesByLine(matches);
        
        // Validate all matches
        const validMatches = this.validateAllMatches(document, groupedMatches);
        
        if (validMatches.length === 0) {
            return true;
        }

        // Create single workspace edit for all changes
        const edit = this.createBatchWorkspaceEdit(document, validMatches);

        // Apply with retry logic
        return this.applyEditWithRetry(edit);
    }

    /**
     * Validates that matches are still valid in the current document
     * @param document - The document to validate against
     * @param matches - The matches to validate
     * @returns Array of valid matches
     */
    private validateMatches(
        document: vscode.TextDocument,
        matches: PixelClassMatch[]
    ): PixelClassMatch[] {
        return matches.filter(match => {
            try {
                // Check if range is still valid
                if (!this.isValidRange(document, match.range)) {
                    return false;
                }

                // Check if the text at the range still matches
                const currentText = document.getText(match.range);
                return currentText === match.originalText;
            } catch (error) {
                console.warn('Error validating match:', error);
                return false;
            }
        });
    }

    /**
     * Validates all matches in grouped format
     * @param document - The document to validate against
     * @param groupedMatches - Matches grouped by line
     * @returns Flattened array of valid matches
     */
    private validateAllMatches(
        document: vscode.TextDocument,
        groupedMatches: Map<number, PixelClassMatch[]>
    ): PixelClassMatch[] {
        const validMatches: PixelClassMatch[] = [];

        for (const [lineNumber, lineMatches] of groupedMatches) {
            // Skip if line doesn't exist
            if (lineNumber >= document.lineCount) {
                continue;
            }

            const validLineMatches = this.validateMatches(document, lineMatches);
            validMatches.push(...validLineMatches);
        }

        return validMatches;
    }

    /**
     * Creates a workspace edit for the given matches
     * @param document - The document to edit
     * @param matches - The matches to replace
     * @returns WorkspaceEdit object
     */
    private createWorkspaceEdit(
        document: vscode.TextDocument,
        matches: PixelClassMatch[]
    ): vscode.WorkspaceEdit {
        const edit = new vscode.WorkspaceEdit();

        // Sort matches in reverse order to avoid position shifts
        const sortedMatches = this.sortMatchesForReplacement(matches);

        // Add each replacement to the edit
        for (const match of sortedMatches) {
            edit.replace(document.uri, match.range, match.convertedText);
        }

        return edit;
    }

    /**
     * Creates a batch workspace edit for multiple matches
     * @param document - The document to edit
     * @param matches - The matches to replace
     * @returns WorkspaceEdit object
     */
    private createBatchWorkspaceEdit(
        document: vscode.TextDocument,
        matches: PixelClassMatch[]
    ): vscode.WorkspaceEdit {
        const edit = new vscode.WorkspaceEdit();

        // Sort all matches in reverse order
        const sortedMatches = this.sortMatchesForReplacement(matches);

        // Add all replacements to a single edit
        for (const match of sortedMatches) {
            edit.replace(document.uri, match.range, match.convertedText);
        }

        return edit;
    }

    /**
     * Applies workspace edit with retry logic
     * @param edit - The workspace edit to apply
     * @returns Promise that resolves to true if successful
     */
    private async applyEditWithRetry(edit: vscode.WorkspaceEdit): Promise<boolean> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < ReplacementHandler.MAX_RETRIES; attempt++) {
            try {
                const success = await vscode.workspace.applyEdit(edit);
                
                if (success) {
                    return true;
                }

                // If not successful, wait before retry
                if (attempt < ReplacementHandler.MAX_RETRIES - 1) {
                    await this.delay(ReplacementHandler.RETRY_DELAY);
                }
            } catch (error) {
                lastError = error as Error;
                console.warn(`Edit attempt ${attempt + 1} failed:`, error);

                // Wait before retry
                if (attempt < ReplacementHandler.MAX_RETRIES - 1) {
                    await this.delay(ReplacementHandler.RETRY_DELAY);
                }
            }
        }

        console.error('Failed to apply edit after all retries:', lastError);
        return false;
    }

    /**
     * Sorts matches in reverse order to avoid position shifts during replacement
     * @param matches - The matches to sort
     * @returns Sorted matches array
     */
    private sortMatchesForReplacement(matches: PixelClassMatch[]): PixelClassMatch[] {
        return [...matches].sort((a, b) => {
            // Sort by line number (descending)
            const lineDiff = b.range.start.line - a.range.start.line;
            if (lineDiff !== 0) {
                return lineDiff;
            }

            // Then by character position (descending)
            return b.range.start.character - a.range.start.character;
        });
    }

    /**
     * Groups matches by line number for better processing
     * @param matches - The matches to group
     * @returns Map of line number to matches
     */
    private groupMatchesByLine(matches: PixelClassMatch[]): Map<number, PixelClassMatch[]> {
        const grouped = new Map<number, PixelClassMatch[]>();

        for (const match of matches) {
            const lineNumber = match.range.start.line;
            
            if (!grouped.has(lineNumber)) {
                grouped.set(lineNumber, []);
            }
            
            grouped.get(lineNumber)!.push(match);
        }

        return grouped;
    }

    /**
     * Checks if a range is valid for the given document
     * @param document - The document to check against
     * @param range - The range to validate
     * @returns True if the range is valid
     */
    private isValidRange(document: vscode.TextDocument, range: vscode.Range): boolean {
        try {
            // Check if start and end positions are valid
            if (range.start.line < 0 || range.start.line >= document.lineCount) {
                return false;
            }

            if (range.end.line < 0 || range.end.line >= document.lineCount) {
                return false;
            }

            // Check character positions
            const startLine = document.lineAt(range.start.line);
            const endLine = document.lineAt(range.end.line);

            if (range.start.character < 0 || range.start.character > startLine.text.length) {
                return false;
            }

            if (range.end.character < 0 || range.end.character > endLine.text.length) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Creates a delay promise
     * @param ms - Milliseconds to delay
     * @returns Promise that resolves after the delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Checks if undo/redo operations will work correctly
     * @param document - The document to check
     * @returns True if undo/redo should work
     */
    canUndoRedo(document: vscode.TextDocument): boolean {
        // VS Code handles undo/redo automatically for WorkspaceEdit operations
        // This method can be used for additional validation if needed
        return !document.isUntitled || document.isDirty;
    }

    /**
     * Gets statistics about the last replacement operation
     * @param matches - The matches that were processed
     * @returns Replacement statistics
     */
    getReplacementStats(matches: PixelClassMatch[]): {
        total: number;
        standard: number;
        custom: number;
        properties: Set<string>;
    } {
        const stats = {
            total: matches.length,
            standard: 0,
            custom: 0,
            properties: new Set<string>()
        };

        for (const match of matches) {
            if (match.isCustomValue) {
                stats.custom++;
            } else {
                stats.standard++;
            }
            
            stats.properties.add(match.property);
        }

        return stats;
    }
}