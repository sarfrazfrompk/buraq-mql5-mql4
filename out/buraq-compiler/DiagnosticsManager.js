'use strict';

const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');

/**
 * DiagnosticsManager - Manages per-file diagnostics in Problems panel
 * Uses a JSON file in .vscode folder as a persistent single source of truth.
 * Each compilation result is stored independently in the database.
 */
class DiagnosticsManager {
    constructor() {
        this.collection = null;
        this.dbPath = null;
        this.workspaceRoot = null;
    }

    /**
     * Initialize the diagnostic collection and persistent database
     * @param {vscode.ExtensionContext} context - Extension context for subscriptions
     */
    initialize(context) {
        this.collection = vscode.languages.createDiagnosticCollection('mql');
        context.subscriptions.push(this.collection);
        
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (this.workspaceRoot) {
            const vscodeDir = pathModule.join(this.workspaceRoot, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            this.dbPath = pathModule.join(vscodeDir, 'buraq-diagnostics.json');
            
            // FRESH START: Clear database on load as requested
            this.clearAll();
            console.log('[DiagnosticsManager] Database cleared for fresh compilation');
        }
        
        console.log('[DiagnosticsManager] Initialized with aggregated persistent DB:', this.dbPath);
    }

    /**
     * Get the canonical form of a file path (resolves casing on Windows)
     * @param {string} filePath 
     * @returns {string}
     */
    getCanonicalPath(filePath) {
        if (!filePath) return filePath;
        try {
            return vscode.Uri.file(filePath).fsPath;
        } catch (e) {
            return filePath;
        }
    }


    /**
     * Refresh the Problems panel by aggregating all errors from the JSON database
     */
    refreshFromDatabase() {
        if (!this.dbPath || !fs.existsSync(this.dbPath) || !this.collection) {
            return;
        }

        try {
            const content = fs.readFileSync(this.dbPath, 'utf8');
            const db = JSON.parse(content);
            
            // Map to aggregate errors by the file they occur in
            const aggregated = new Map(); // Map<actualFilePath, vscode.Diagnostic[]>
            
            // db keys are the actual files that have errors
            Object.keys(db).forEach(filePath => {
                const errors = db[filePath];
                if (!Array.isArray(errors)) return;

                const canonicalPath = this.getCanonicalPath(filePath);
                if (!aggregated.has(canonicalPath)) {
                    aggregated.set(canonicalPath, []);
                }

                errors.forEach(err => {
                    const range = new vscode.Range(
                        err.range.start.line,
                        err.range.start.character,
                        err.range.end.line,
                        err.range.end.character
                    );
                    
                    const severity = err.severity === 'Error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                    const diag = new vscode.Diagnostic(range, err.message, severity);
                    diag.source = 'Buraq Compiler';
                    diag.code = err.code;
                    
                    aggregated.get(canonicalPath).push(diag);
                });
            });
            
            // Clear current collection and apply aggregated results
            this.collection.clear();
            aggregated.forEach((diagnostics, filePath) => {
                this.collection.set(vscode.Uri.file(filePath), diagnostics);
            });
            
            console.log('[DiagnosticsManager] Problems panel refreshed');
        } catch (error) {
            console.error('[DiagnosticsManager] Error refreshing from database:', error);
        }
    }

    /**
     * Set diagnostics for a specific compilation run
     * @param {string} sourceFilePath - The main file that was compiled
     * @param {Map<string, vscode.Diagnostic[]>} diagnosticsByFile - Map of actual file -> diagnostics
     */
    setDiagnostics(sourceFilePath, diagnosticsByFile) {
        const canonicalSource = this.getCanonicalPath(sourceFilePath);
        if (!canonicalSource || !this.dbPath) return;

        // 1. Read the DB
        let db = {};
        if (fs.existsSync(this.dbPath)) {
            try {
                db = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            } catch (e) { db = {}; }
        }

        // 2. Resolve all involved files (compiled file + all recursively included files)
        const involvedFiles = getIncludedFilesRecursive(canonicalSource, this.workspaceRoot);

        // 3. Update the database entries for all involved files
        involvedFiles.forEach(file => {
            const canonicalFile = this.getCanonicalPath(file);
            const diagnostics = diagnosticsByFile.get(canonicalFile);

            if (diagnostics && diagnostics.length > 0) {
                const serializableErrors = [];
                diagnostics.forEach(d => {
                    serializableErrors.push({
                        file: canonicalFile,
                        message: d.message,
                        range: {
                            start: { line: d.range.start.line, character: d.range.start.character },
                            end: { line: d.range.end.line, character: d.range.end.character }
                        },
                        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'Error' : 'Warning',
                        code: d.code
                    });
                });
                db[canonicalFile] = serializableErrors;
            } else {
                delete db[canonicalFile];
            }
        });

        // 4. Save back to DB
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 4), 'utf8');
        } catch (error) {
            console.error('[DiagnosticsManager] Error saving database:', error);
        }

        // 5. Refresh the Problems panel with the new state
        this.refreshFromDatabase();
    }

    /**
     * Clear diagnostics for a specific compiled file
     * @param {string} sourceFilePath 
     */
    clearDiagnostics(filePath) {
        const canonicalPath = this.getCanonicalPath(filePath);
        if (!canonicalPath || !this.dbPath) return;

        let db = {};
        if (fs.existsSync(this.dbPath)) {
            try {
                db = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            } catch (e) { db = {}; }
        }

        delete db[canonicalPath];

        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 4), 'utf8');
        } catch (error) {
            console.error('[DiagnosticsManager] Error saving database:', error);
        }

        this.refreshFromDatabase();
    }

    /**
     * Clear all diagnostics from DB and Problems panel
     */
    clearAll() {
        if (this.dbPath && fs.existsSync(this.dbPath)) {
            try {
                fs.writeFileSync(this.dbPath, JSON.stringify({}, null, 4), 'utf8');
            } catch (e) {}
        }
        if (this.collection) {
            this.collection.clear();
        }
    }

    /**
     * Parse compiler log and extract diagnostics
     * @param {string} logContent - Raw log content from compiler
     * @param {string} sourceFilePath - Path to the source file being compiled
     * @returns {Object}
     */
    parseLog(logContent, sourceFilePath) {
        const outputLines = [];
        const diagnosticsByFile = new Map();
        const involvedFiles = new Set([sourceFilePath]);
        let hasErrors = false;
        let errorCount = 0;
        let warningCount = 0;

        const lines = logContent.replace(/\u{FEFF}/gu, '').split('\n');

        const ANSI_COLORS = {
            RED: '\x1b[31m',
            GREEN: '\x1b[32m',
            YELLOW: '\x1b[33m',
            BLUE: '\x1b[34m',
            RESET: '\x1b[0m'
        };

        const colorizeError = (t) => `${ANSI_COLORS.RED}${t}${ANSI_COLORS.RESET}`;
        const colorizeWarning = (t) => `${ANSI_COLORS.YELLOW}${t}${ANSI_COLORS.RESET}`;
        const colorizeInfo = (t) => `${ANSI_COLORS.BLUE}${t}${ANSI_COLORS.RESET}`;
        const colorizeSuccess = (t) => `${ANSI_COLORS.GREEN}${t}${ANSI_COLORS.RESET}`;

        lines.forEach(item => {
            const trimmed = item.trim();
            if (!trimmed) return;

            if (trimmed.includes(': information: including')) {
                const pm = item.match(/[a-z]:\\.+(?= :)/gi);
                if (pm) involvedFiles.add(pm[0].trim());
            }

            if (trimmed.includes('Result:') || trimmed.includes(': information: result')) {
                outputLines.push('');
                // Note: We ignore the counts from the Result line as per user request to use our own manual count
                // Final summary output will be added at the end of parseLog instead of here if needed,
                // or we just let the caller handle it. For now, we'll keep the logic that builds outputLines.

            } else {
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

                    const statusIndicator = isError ? '[ERROR]  ' : '[WARNING]';
                    const colorFunc = isError ? colorizeError : colorizeWarning;
                    outputLines.push(colorFunc(padText(statusIndicator, 12) + `${errType} ${errCode}: ${errMessage} (${lineNum},${colNum})`));

                    // Manual counting as requested by user
                    if (isError) {
                        errorCount++;
                    } else {
                        warningCount++;
                    }


                    if (filePath) {
                        const normalizedPath = filePath.replace(/\//g, '\\');
                        let resolvedPath = null;
                        
                        if (fs.existsSync(normalizedPath)) {
                            resolvedPath = normalizedPath;
                        } else if (fs.existsSync(filePath)) {
                            resolvedPath = filePath;
                        } else {
                            // Try resolving relative paths
                            const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
                            const isMQL4 = (vscode.workspace.name || '').includes('MQL4') || (sourceFilePath.includes('MQL4') || sourceFilePath.includes('mql4'));
                            const incDir = isMQL4 ? config.Metaeditor?.Include4Dir : config.Metaeditor?.Include5Dir;

                            const candidates = [
                                pathModule.resolve(pathModule.dirname(sourceFilePath), filePath),
                                pathModule.resolve(this.workspaceRoot || '', filePath)
                            ];
                            if (incDir) {
                                candidates.push(pathModule.resolve(incDir, filePath));
                            }
                            for (const cand of candidates) {
                                if (fs.existsSync(cand)) {
                                    resolvedPath = cand;
                                    break;
                                }
                            }
                        }

                        if (resolvedPath) {
                            const actualPath = this.getCanonicalPath(resolvedPath);
                            involvedFiles.add(actualPath);

                            const line = Math.max(0, lineNum - 1);
                            const col = Math.max(0, colNum - 1);
                            const range = new vscode.Range(line, col, line, col + 100);
                            const severity = isError ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                            const diagnostic = new vscode.Diagnostic(range, errMessage, severity);
                            diagnostic.source = 'Buraq Compiler';
                            diagnostic.code = errCode;
                            
                            if (!diagnosticsByFile.has(actualPath)) diagnosticsByFile.set(actualPath, []);
                            diagnosticsByFile.get(actualPath).push(diagnostic);
                        }
                    }
                } else if (!trimmed.includes(': information:')) {
                    const isError = trimmed.toLowerCase().includes('error');
                    const colorFunc = isError ? colorizeError : colorizeInfo;
                    outputLines.push(colorFunc(padText(isError ? '[ERROR]  ' : '[INFO]   ', 12) + trimmed));
                }
            }
        });

        // Determine overall success based on manual counts
        hasErrors = errorCount > 0;

        // Post-process outputLines to add the manual summary at the end for consistent terminal output
        if (hasErrors) {
            outputLines.push(colorizeError(padText('[ERROR]  ', 12) + `Compilation failed: ${errorCount} error(s), ${warningCount} warning(s)`));
        } else if (warningCount > 0) {
            outputLines.push(colorizeWarning(padText('[WARNING]', 12) + `Compilation completed with ${warningCount} warning(s)`));
        } else {
            outputLines.push(colorizeSuccess(padText('[SUCCESS]', 12) + 'Compilation successful - no errors or warnings'));
        }


        return {
            diagnosticsByFile,
            involvedFiles,
            hasErrors,
            outputLines,
            errorCount,
            warningCount
        };

    }
}

function padText(text, width, align = 'left') {
    const visibleLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = width - visibleLen;
    if (padding <= 0) return text;
    const spaces = ' '.repeat(padding);
    switch (align) {
        case 'right': return spaces + text;
        case 'center':
            const lp = Math.floor(padding / 2);
            const rp = padding - lp;
            return ' '.repeat(lp) + text + ' '.repeat(rp);
        default: return text + spaces;
    }
}

/**
 * Resolve include directive name to absolute path
 */
function resolveIncludePath(includeName, currentDir, workspaceRoot) {
    // 1. Try relative to currentDir (for "LocalPath")
    const localPath = pathModule.resolve(currentDir, includeName);
    if (fs.existsSync(localPath)) return localPath;
    
    // 2. Try relative to the Include directory from configuration
    const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
    const isMQL4 = (vscode.workspace.name || '').includes('MQL4') || (currentDir.toLowerCase().includes('mql4'));
    const incDir = isMQL4 ? config.Metaeditor?.Include4Dir : config.Metaeditor?.Include5Dir;
    if (incDir) {
        const includePath = pathModule.resolve(incDir, includeName);
        if (fs.existsSync(includePath)) return includePath;
    }
    
    // 3. Try relative to workspace root
    if (workspaceRoot) {
        const workspacePath = pathModule.resolve(workspaceRoot, includeName);
        if (fs.existsSync(workspacePath)) return workspacePath;
    }
    
    return null;
}

/**
 * Get all recursively included files for a given MQL source file
 */
function getIncludedFilesRecursive(filePath, workspaceRoot, visited = new Set()) {
    try {
        const canonical = vscode.Uri.file(filePath).fsPath;
        if (visited.has(canonical)) return visited;
        visited.add(canonical);
        
        if (!fs.existsSync(canonical)) return visited;
        const content = fs.readFileSync(canonical, 'utf8');
        const includeRegex = /#include\s*<([^>]+)>|#include\s*"([^"]+)"/g;
        let match;
        const currentDir = pathModule.dirname(canonical);
        while ((match = includeRegex.exec(content)) !== null) {
            const includeName = match[1] || match[2];
            const resolved = resolveIncludePath(includeName, currentDir, workspaceRoot);
            if (resolved) {
                getIncludedFilesRecursive(resolved, workspaceRoot, visited);
            }
        }
    } catch (e) {
        console.error('[DiagnosticsManager] Error parsing includes:', e);
    }
    return visited;
}

module.exports = { DiagnosticsManager };
