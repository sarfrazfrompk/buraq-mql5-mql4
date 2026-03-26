'use strict';

const fs = require('fs');
const pathModule = require('path');
const vscode = require('vscode');

/**
 * LogFileManager - Manages compiler log files in centralized temp folder
 * All .log files are created in .vscode/temp instead of source directories
 */
class LogFileManager {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.vscodePath = pathModule.join(workspaceRoot, '.vscode');
        this.tempPath = pathModule.join(this.vscodePath, 'temp');
        this.ensureTempFolder();
    }

    /**
     * Ensure temp folder exists
     */
    ensureTempFolder() {
        if (!fs.existsSync(this.tempPath)) {
            try {
                fs.mkdirSync(this.tempPath, { recursive: true });
                console.log('[LogFileManager] Created temp folder:', this.tempPath);
            } catch (error) {
                console.error('[LogFileManager] Failed to create temp folder:', error.message);
            }
        }
    }

    /**
     * Generate a unique log file path for a source file
     * @param {string} sourceFilePath - Path to the source .mq5/.mq4/.mqh file
     * @returns {string} - Path to log file in temp folder
     */
    getLogPath(sourceFilePath) {
        const fileName = pathModule.basename(sourceFilePath);
        const baseName = fileName.replace(/\.(mq5|mq4|mqh)$/i, '');
        const timestamp = Date.now();
        const logFileName = `${baseName}_${timestamp}.log`;
        return pathModule.join(this.tempPath, logFileName);
    }

    /**
     * Read log file content
     * @param {string} logPath - Path to log file
     * @returns {Promise<string|null>} - Log content or null if error
     */
    async readLog(logPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(logPath)) {
                console.log('[LogFileManager] Log file not found:', logPath);
                resolve(null);
                return;
            }

            fs.readFile(logPath, 'utf16le', (error, data) => {
                if (error) {
                    console.error('[LogFileManager] Failed to read log:', error.message);
                    resolve(null);
                } else {
                    resolve(data.toString());
                }
            });
        });
    }

    /**
     * Read log file content synchronously
     * @param {string} logPath - Path to log file
     * @returns {string|null} - Log content or null if error
     */
    readLogSync(logPath) {
        if (!fs.existsSync(logPath)) {
            console.log('[LogFileManager] Log file not found:', logPath);
            return null;
        }

        try {
            const data = fs.readFileSync(logPath, 'utf16le');
            return data.toString();
        } catch (error) {
            console.error('[LogFileManager] Failed to read log:', error.message);
            return null;
        }
    }

    /**
     * Delete a log file after processing
     * @param {string} logPath - Path to log file
     */
    deleteLog(logPath) {
        if (!logPath || !fs.existsSync(logPath)) {
            return;
        }

        fs.unlink(logPath, (error) => {
            if (error) {
                console.log('[LogFileManager] Failed to delete log:', logPath, error.message);
            } else {
                console.log('[LogFileManager] Deleted log:', logPath);
            }
        });
    }

    /**
     * Delete a log file synchronously
     * @param {string} logPath - Path to log file
     */
    deleteLogSync(logPath) {
        if (!logPath || !fs.existsSync(logPath)) {
            return;
        }

        try {
            fs.unlinkSync(logPath);
            console.log('[LogFileManager] Deleted log:', logPath);
        } catch (error) {
            console.log('[LogFileManager] Failed to delete log:', logPath, error.message);
        }
    }

    /**
     * Clean up all log files in temp folder
     */
    cleanupAll() {
        if (!fs.existsSync(this.tempPath)) {
            return;
        }

        try {
            const entries = fs.readdirSync(this.tempPath);
            for (const entry of entries) {
                if (entry.endsWith('.log')) {
                    const fullPath = pathModule.join(this.tempPath, entry);
                    try {
                        fs.unlinkSync(fullPath);
                        console.log('[LogFileManager] Cleaned up old log:', fullPath);
                    } catch (error) {
                        // Ignore cleanup errors
                    }
                }
            }
        } catch (error) {
            console.error('[LogFileManager] Failed to cleanup temp folder:', error.message);
        }
    }

    /**
     * Get the temp folder path
     * @returns {string}
     */
    getTempPath() {
        return this.tempPath;
    }

    /**
     * Get the vscode folder path
     * @returns {string}
     */
    getVscodePath() {
        return this.vscodePath;
    }
}

module.exports = { LogFileManager };
