'use strict';

const vscode = require('vscode');
const childProcess = require('child_process');
const fs = require('fs');
const pathModule = require('path');
const { LogFileManager } = require('./LogFileManager');
const { DiagnosticsManager } = require('./DiagnosticsManager');
const EventEmitter = require('events');
const { compileFileCore } = require('./compilerCore');

/**
 * CompilationQueue - Sequential compilation manager
 * Compiles files one by one, waiting for each to complete before proceeding
 * No timers, no race conditions, proper Promise-based completion
 */
class CompilationQueue extends EventEmitter {
    constructor(workspaceRoot, diagnosticsManager) {
        super();
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
            if (this.queue.length === 0 && !this.isCompiling) {
                this.emit('finished');
            }
            return;
        }

        this.isCompiling = true;
        const queueItem = this.queue.shift();
        this.currentFile = queueItem.filePath;
        this.compilingSet.add(queueItem.filePath);

        console.log('[CompilationQueue] Processing:', queueItem.filePath);
        this.emit('compiling', this.currentFile);

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
                this.emit('finished');
            }
        }
    }

    /**
     * Compile a single file using the unified compileFileCore function
     * @param {string} filePath - Path to file to compile
     * @param {Object} options - Compilation options (checkOnly, etc.)
     * @returns {Promise<Object>} - Compilation result
     */
    async compileFile(filePath, options = {}) {
        const compileType = options.checkOnly ? 0 : 1;
        // Workspace scan sequential compilations should compile silently
        const coreOptions = {
            silentWorkspace: true
        };
        return compileFileCore(filePath, compileType, coreOptions, this.diagnosticsManager, this.logFileManager);
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
