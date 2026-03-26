'use strict';

const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');

/**
 * DiagnosticsManager - Manages per-file diagnostics in Problems panel
 * Accumulates diagnostics from all compiled files without overwriting
 */
class DiagnosticsManager {
    constructor() {
        // Map<filePath, Diagnostic[]> - Stores diagnostics per file
        this.diagnosticsMap = new Map();
        // DiagnosticCollection for VS Code Problems panel
        this.collection = null;
    }

    /**
     * Initialize the diagnostic collection
     * @param {vscode.ExtensionContext} context - Extension context for subscriptions
     */
    initialize(context) {
        this.collection = vscode.languages.createDiagnosticCollection('mql');
        context.subscriptions.push(this.collection);
        console.log('[DiagnosticsManager] Initialized with collection');
    }

    /**
     * Set diagnostics for a specific file
     * This updates only the specified file's diagnostics, preserving others
     * @param {string} filePath - Absolute path to the source file
     * @param {vscode.Diagnostic[]} diagnostics - Array of diagnostics for this file
     */
    setDiagnostics(filePath, diagnostics) {
        if (!filePath || !this.collection) {
            console.log('[DiagnosticsManager] Cannot set diagnostics - not initialized or invalid path');
            return;
        }

        // Store in our internal map
        this.diagnosticsMap.set(filePath, diagnostics || []);

        // Update VS Code's Problems panel for this specific file
        const uri = vscode.Uri.file(filePath);
        this.collection.set(uri, diagnostics || []);

        console.log('[DiagnosticsManager] Set', (diagnostics || []).length, 'diagnostics for:', filePath);
    }

    /**
     * Get diagnostics for a specific file
     * @param {string} filePath - Absolute path to the source file
     * @returns {vscode.Diagnostic[]} - Array of diagnostics
     */
    getDiagnostics(filePath) {
        return this.diagnosticsMap.get(filePath) || [];
    }

    /**
     * Clear diagnostics for a specific file
     * @param {string} filePath - Absolute path to the source file
     */
    clearDiagnostics(filePath) {
        if (!filePath || !this.collection) {
            return;
        }

        this.diagnosticsMap.delete(filePath);
        const uri = vscode.Uri.file(filePath);
        this.collection.delete(uri);

        console.log('[DiagnosticsManager] Cleared diagnostics for:', filePath);
    }

    /**
     * Clear all diagnostics from all files
     */
    clearAll() {
        if (!this.collection) {
            return;
        }

        this.diagnosticsMap.clear();
        this.collection.clear();

        console.log('[DiagnosticsManager] Cleared all diagnostics');
    }

    /**
     * Get all diagnostics from all files
     * @returns {Map<string, vscode.Diagnostic[]>} - Map of filePath to diagnostics
     */
    getAllDiagnostics() {
        return new Map(this.diagnosticsMap);
    }

    /**
     * Get total count of all diagnostics
     * @returns {Object} - Count of errors and warnings
     */
    getCount() {
        let errorCount = 0;
        let warningCount = 0;

        for (const [filePath, diagnostics] of this.diagnosticsMap) {
            for (const diagnostic of diagnostics) {
                if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
                    errorCount++;
                } else if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
                    warningCount++;
                }
            }
        }

        return { errors: errorCount, warnings: warningCount, total: errorCount + warningCount };
    }

    /**
     * Parse compiler log and extract diagnostics
     * This integrates with your existing replaceLog logic
     * @param {string} logContent - Raw log content from compiler
     * @param {string} sourceFilePath - Path to the source file being compiled
     * @returns {Object} - { diagnostics: Diagnostic[], hasErrors: boolean, outputLines: string[] }
     */
    parseLog(logContent, sourceFilePath) {
        const outputLines = [];
        const diagnostics = [];
        let hasErrors = false;
        let errorCount = 0;
        let warningCount = 0;

        const lines = logContent.replace(/\u{FEFF}/gu, '').split('\n');

        // ANSI color helpers (from your existing code)
        const ANSI_COLORS = {
            RED: '\x1b[31m',
            GREEN: '\x1b[32m',
            YELLOW: '\x1b[33m',
            BLUE: '\x1b[34m',
            RESET: '\x1b[0m'
        };

        function colorizeError(text) {
            return `${ANSI_COLORS.RED}${text}${ANSI_COLORS.RESET}`;
        }

        function colorizeWarning(text) {
            return `${ANSI_COLORS.YELLOW}${text}${ANSI_COLORS.RESET}`;
        }

        function colorizeInfo(text) {
            return `${ANSI_COLORS.BLUE}${text}${ANSI_COLORS.RESET}`;
        }

        function colorizeSuccess(text) {
            return `${ANSI_COLORS.GREEN}${text}${ANSI_COLORS.RESET}`;
        }

        lines.forEach(item => {
            const trimmed = item.trim();
            if (!trimmed) return;

            // Handle result summary
            if (trimmed.includes('Result:') || trimmed.includes(': information: result')) {
                const ecMatch = item.match(/(\d+)\s+error/i);
                const wcMatch = item.match(/(\d+)\s+warning/i);

                errorCount = ecMatch ? parseInt(ecMatch[1]) : 0;
                warningCount = wcMatch ? parseInt(wcMatch[1]) : 0;

                outputLines.push('');

                if (errorCount > 0) {
                    hasErrors = true;
                    outputLines.push(colorizeError(`[ERROR]   Compilation failed: ${errorCount} error(s), ${warningCount} warning(s)`));
                } else if (warningCount > 0) {
                    outputLines.push(colorizeWarning(`[WARNING] Compilation completed with ${warningCount} warning(s)`));
                } else {
                    outputLines.push(colorizeSuccess('[SUCCESS] Compilation successful - no errors or warnings'));
                }
            }
            // Handle errors and warnings
            // MetaEditor format: FilePath(line,col) : error NNN: message
            else {
                const errorRegex = /^(.+)\((\d+),(\d+)\)\s*:\s*(error|warning)\s+(\d+):\s*(.+)$/i;
                const match = trimmed.match(errorRegex);

                if (match) {
                    const filePath = match[1].trim();
                    const lineNum = parseInt(match[2]);
                    const colNum = parseInt(match[3]);
                    const errType = match[4].toLowerCase();
                    const errCode = match[5];
                    const errMessage = match[6].trim();

                    const isError = errType === 'error';

                    // Add to terminal output
                    const statusIndicator = isError ? '[ERROR]  ' : '[WARNING]';
                    const colorFunc = isError ? colorizeError : colorizeWarning;
                    const fullMessage = `${errType} ${errCode}: ${errMessage}`;
                    const posStr = `(${lineNum},${colNum})`;
                    outputLines.push(colorFunc(padText(statusIndicator, 12) + fullMessage + ' ' + posStr));

                    // Build diagnostic for Problems panel
                    if (filePath && fs.existsSync(filePath)) {
                        const line = Math.max(0, lineNum - 1);
                        const col = Math.max(0, colNum - 1);
                        const range = new vscode.Range(line, col, line, col + 100);
                        const severity = isError ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                        const diagnostic = new vscode.Diagnostic(range, errMessage, severity);
                        diagnostic.source = 'Buraq Compiler';
                        diagnostic.code = errCode;
                        diagnostics.push(diagnostic);
                    }
                }
                // Handle other informational messages
                else if (trimmed.includes(': information:')) {
                    // Skip or log info messages
                } else {
                    // Other messages
                    const isError = trimmed.toLowerCase().includes('error');
                    const statusIndicator = isError ? '[ERROR]  ' : '[INFO]   ';
                    const colorFunc = isError ? colorizeError : colorizeInfo;
                    outputLines.push(colorFunc(padText(statusIndicator, 12) + trimmed));
                }
            }
        });

        return {
            diagnostics: diagnostics,
            hasErrors: hasErrors,
            outputLines: outputLines,
            errorCount: errorCount,
            warningCount: warningCount
        };
    }

    /**
     * Get the diagnostic collection
     * @returns {vscode.DiagnosticCollection}
     */
    getCollection() {
        return this.collection;
    }
}

/**
 * Helper function to pad text (from your existing code)
 */
function padText(text, width, align = 'left') {
    const visibleLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = width - visibleLen;
    if (padding <= 0) return text;
    const spaces = ' '.repeat(padding);
    switch (align) {
        case 'right': return spaces + text;
        case 'center':
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
        default: return text + spaces;
    }
}

module.exports = { DiagnosticsManager };
