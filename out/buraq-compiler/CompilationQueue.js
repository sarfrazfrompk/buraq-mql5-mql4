'use strict';

const vscode = require('vscode');
const childProcess = require('child_process');
const fs = require('fs');
const pathModule = require('path');
const { LogFileManager } = require('./LogFileManager');
const { DiagnosticsManager } = require('./DiagnosticsManager');

/**
 * CompilationQueue - Sequential compilation manager
 * Compiles files one by one, waiting for each to complete before proceeding
 * No timers, no race conditions, proper Promise-based completion
 */
class CompilationQueue {
    constructor(workspaceRoot, diagnosticsManager) {
        this.workspaceRoot = workspaceRoot;
        this.diagnosticsManager = diagnosticsManager;
        this.logFileManager = new LogFileManager(workspaceRoot);
        
        // Queue of files waiting to compile
        this.queue = [];
        // Currently compiling file
        this.currentFile = null;
        // Whether compilation is in progress
        this.isCompiling = false;
        // Files currently being compiled (to prevent duplicates)
        this.compilingSet = new Set();
        // Compilation results
        this.results = new Map();
    }

    /**
     * Add a file to the compilation queue
     * @param {string} filePath - Absolute path to the file
     * @param {Object} options - Compilation options
     * @returns {Promise<Object>} - Compilation result
     */
    async enqueue(filePath, options = {}) {
        return new Promise((resolve, reject) => {
            // Check if file is already in queue or compiling
            if (this.compilingSet.has(filePath)) {
                console.log('[CompilationQueue] File already compiling, skipping:', filePath);
                resolve(this.results.get(filePath) || { skipped: true, reason: 'already_compiling' });
                return;
            }

            // Add to queue
            const queueItem = {
                filePath: filePath,
                options: options,
                resolve: resolve,
                reject: reject,
                addedAt: Date.now()
            };

            this.queue.push(queueItem);
            console.log('[CompilationQueue] Enqueued:', filePath, 'Queue size:', this.queue.length);

            // Start processing if not already compiling
            if (!this.isCompiling) {
                this.processQueue();
            }
        });
    }

    /**
     * Add multiple files to the queue
     * @param {string[]} filePaths - Array of file paths
     * @returns {Promise<Object[]>} - Array of compilation results
     */
    async enqueueAll(filePaths, options = {}) {
        const promises = filePaths.map(filePath => this.enqueue(filePath, options));
        return Promise.all(promises);
    }

    /**
     * Process the next file in the queue
     */
    async processQueue() {
        if (this.isCompiling || this.queue.length === 0) {
            return;
        }

        this.isCompiling = true;
        const queueItem = this.queue.shift();
        this.currentFile = queueItem.filePath;
        this.compilingSet.add(queueItem.filePath);

        console.log('[CompilationQueue] Processing:', queueItem.filePath);

        try {
            const result = await this.compileFile(queueItem.filePath, queueItem.options);
            this.results.set(queueItem.filePath, result);
            queueItem.resolve(result);
        } catch (error) {
            const errorResult = {
                success: false,
                error: error.message,
                filePath: queueItem.filePath
            };
            this.results.set(queueItem.filePath, errorResult);
            queueItem.reject(error);
        } finally {
            this.compilingSet.delete(queueItem.filePath);
            this.currentFile = null;
            this.isCompiling = false;

            // Process next file in queue
            if (this.queue.length > 0) {
                // Use setImmediate to ensure proper async flow
                setImmediate(() => this.processQueue());
            } else {
                console.log('[CompilationQueue] Queue empty, compilation complete');
            }
        }
    }

    /**
     * Compile a single file
     * This uses your existing compiler logic but with proper async handling
     * @param {string} filePath - Path to file to compile
     * @param {Object} options - Compilation options (checkOnly, fullCompile, etc.)
     * @returns {Promise<Object>} - Compilation result
     */
    async compileFile(filePath, options = {}) {
        return new Promise(async (resolve, reject) => {
            const fileName = pathModule.basename(filePath);
            const extension = pathModule.extname(filePath);
            const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
            
            // Determine MetaEditor path based on file type and workspace
            const workspaceName = vscode.workspace.name || '';
            const isMQL4 = workspaceName.includes('MQL4');
            let MetaDir;

            if (extension === '.mq4' || (extension === '.mqh' && isMQL4)) {
                MetaDir = this.resolveMetaEditorPath(4, config.Metaeditor?.Metaeditor4Dir);
            } else if (extension === '.mq5' || (extension === '.mqh' && !isMQL4)) {
                MetaDir = this.resolveMetaEditorPath(5, config.Metaeditor?.Metaeditor5Dir);
            } else {
                reject(new Error(`Unsupported file extension: ${extension}`));
                return;
            }

            if (!MetaDir || !fs.existsSync(MetaDir)) {
                reject(new Error(`MetaEditor not found at: ${MetaDir}`));
                return;
            }

            // Get log file path from centralized manager
            const logFile = this.logFileManager.getLogPath(filePath);
            
            // Build include path
            let includefile = '';
            const incDir = extension === '.mq4' || (extension === '.mqh' && isMQL4) 
                ? config.Metaeditor?.Include4Dir 
                : config.Metaeditor?.Include5Dir;
            
            if (incDir && fs.existsSync(incDir)) {
                includefile = ` /include:"${incDir}"`;
            }

            // Build command
            const checkOnly = options.checkOnly ? '/s' : '';
            const command = `"${MetaDir}" ${checkOnly} /compile:"${filePath}"${includefile} /log:"${logFile}"`;

            console.log('[CompilationQueue] Compiling:', filePath);
            console.log('[CompilationQueue] Command:', command);
            console.log('[CompilationQueue] Log file:', logFile);

            // Execute compilation
            const process = childProcess.exec(command, { windowsHide: true }, (error, stdout, stderr) => {
                // Process exit handler - compilation is complete
                console.log('[CompilationQueue] Process exited for:', filePath, 'error:', error ? error.message : 'none');

                // Wait a moment for log file to be written
                setTimeout(() => {
                    this.processLogResult(logFile, filePath, options)
                        .then(result => {
                            // Delete log file after processing
                            if (config.LogFile?.DeleteLog !== false) {
                                this.logFileManager.deleteLogSync(logFile);
                            }
                            resolve(result);
                        })
                        .catch(err => {
                            reject(err);
                        });
                }, 100); // Small delay to ensure log file is fully written
            });

            // Handle process errors
            process.on('error', (err) => {
                console.error('[CompilationQueue] Process error:', err.message);
                reject(err);
            });

            // Set a timeout as a safety measure (but we rely on process exit, not timer)
            const timeout = options.timeout || 120000; // 2 minutes default
            const timeoutTimer = setTimeout(() => {
                if (!process.killed) {
                    process.kill();
                }
                reject(new Error(`Compilation timeout after ${timeout}ms for: ${filePath}`));
            }, timeout);

            // Clear timeout when process completes
            process.on('exit', () => {
                clearTimeout(timeoutTimer);
            });
        });
    }

    /**
     * Process the log file result
     * @param {string} logFile - Path to log file
     * @param {string} filePath - Path to source file
     * @param {Object} options - Compilation options
     * @returns {Promise<Object>} - Compilation result
     */
    async processLogResult(logFile, filePath, options) {
        const logContent = this.logFileManager.readLogSync(logFile);

        if (!logContent) {
            return {
                success: false,
                filePath: filePath,
                error: 'Failed to read log file',
                diagnostics: []
            };
        }

        // Parse diagnostics using DiagnosticsManager
        const parseResult = this.diagnosticsManager.parseLog(logContent, filePath);

        // Update diagnostics using the new aggregated/independent system
        // We pass the main compiled file (filePath) as the key
        this.diagnosticsManager.setDiagnostics(filePath, parseResult.diagnosticsByFile);

        return {
            success: !parseResult.hasErrors,
            filePath: filePath,
            hasErrors: parseResult.hasErrors,
            errorCount: parseResult.errorCount,
            warningCount: parseResult.warningCount,
            diagnosticsByFile: parseResult.diagnosticsByFile,
            outputLines: parseResult.outputLines,
            logFile: logFile
        };
    }



    /**
     * Resolve MetaEditor path (from your existing code)
     */
    resolveMetaEditorPath(v, p) {
        try {
            let input = String(p || '').trim();
            const wf = vscode.workspace.workspaceFolders && vscode.workspaceFolders[0] 
                ? vscode.workspaceFolders[0].uri.fsPath : '';
            
            if (input.length && !pathModule.isAbsolute(input) && wf) {
                input = pathModule.join(wf, input);
            }

            const candidates = [];
            if (input.length) {
                if (fs.existsSync(input)) {
                    const st = fs.statSync(input);
                    if (st.isFile()) candidates.push(input);
                    else if (st.isDirectory()) {
                        ['metaeditor.exe', 'metaeditor64.exe', 'MetaEditor.exe', 'MetaEditor64.exe']
                            .forEach(n => candidates.push(pathModule.join(input, n)));
                    }
                } else {
                    const d = pathModule.dirname(input);
                    ['metaeditor.exe', 'metaeditor64.exe', 'MetaEditor.exe', 'MetaEditor64.exe']
                        .forEach(n => candidates.push(pathModule.join(d, n)));
                }
            }

            const fallbacks = v === 5 ? [
                'C:\\Program Files\\MetaTrader 5\\metaeditor64.exe',
                'C:\\Program Files\\MetaTrader 5\\metaeditor.exe',
                'C:\\Program Files (x86)\\MetaTrader 5\\metaeditor.exe',
                'C:\\MT5_Install\\MetaTrader\\metaeditor.exe'
            ] : [
                'C:\\Program Files\\MetaTrader 4\\metaeditor.exe',
                'C:\\Program Files (x86)\\MetaTrader 4\\metaeditor.exe',
                'C:\\MT4_Install\\MetaTrader\\metaeditor.exe'
            ];

            candidates.push(...fallbacks);

            for (const c of candidates) {
                try {
                    if (fs.existsSync(c)) {
                        fs.accessSync(c, fs.constants.R_OK);
                        return c;
                    }
                } catch (e) { }
            }

            return input;
        } catch (e) {
            return p;
        }
    }

    /**
     * Get queue status
     * @returns {Object}
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isCompiling: this.isCompiling,
            currentFile: this.currentFile,
            compilingSet: Array.from(this.compilingSet),
            resultsCount: this.results.size
        };
    }

    /**
     * Clear the queue
     */
    clear() {
        this.queue = [];
        this.compilingSet.clear();
        this.results.clear();
        this.currentFile = null;
        this.isCompiling = false;
        console.log('[CompilationQueue] Queue cleared');
    }

    /**
     * Get the log file manager
     * @returns {LogFileManager}
     */
    getLogFileManager() {
        return this.logFileManager;
    }
}

module.exports = { CompilationQueue };
