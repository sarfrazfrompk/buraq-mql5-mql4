'use strict';

const fs = require('fs');
const pathModule = require('path');
const vscode = require('vscode');
const { BuraqIgnoreParser } = require('./BuraqIgnoreParser');

/**
 * WorkspaceScanner - Scans workspace for MQL files
 * Finds all .mq5, .mq4, .mqh files while respecting .buraqignore
 */
class WorkspaceScanner {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.ignoreParser = new BuraqIgnoreParser(workspaceRoot);
        this.supportedExtensions = ['.mq5', '.mq4', '.mqh'];
    }

    /**
     * Scan workspace for all supported MQL files
     * @returns {Promise<string[]>} - Array of absolute file paths
     */
    async scan() {
        const files = [];

        if (!this.workspaceRoot) {
            console.log('[WorkspaceScanner] No workspace root, skipping scan');
            return files;
        }

        console.log('[WorkspaceScanner] Starting workspace scan:', this.workspaceRoot);

        try {
            await this.scanDirectory(this.workspaceRoot, files);
        } catch (error) {
            console.error('[WorkspaceScanner] Error during scan:', error.message);
        }

        // Sort files for deterministic compilation order
        files.sort((a, b) => a.localeCompare(b));

        console.log('[WorkspaceScanner] Found', files.length, 'MQL files');
        return files;
    }

    /**
     * Recursively scan a directory for MQL files
     * @param {string} dirPath - Directory to scan
     * @param {string[]} files - Array to collect file paths
     */
    async scanDirectory(dirPath, files) {
        let entries;

        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch (error) {
            console.log('[WorkspaceScanner] Cannot read directory:', dirPath, error.message);
            return;
        }

        for (const entry of entries) {
            const fullPath = pathModule.join(dirPath, entry.name);

            // Skip ignored directories and files
            if (this.ignoreParser.isIgnored(fullPath)) {
                continue;
            }

            // Skip common non-essential directories
            if (entry.isDirectory()) {
                const dirName = entry.name.toLowerCase();
                if (this.shouldSkipDirectory(dirName)) {
                    console.log('[WorkspaceScanner] Skipping directory:', fullPath);
                    continue;
                }

                await this.scanDirectory(fullPath, files);
            } else if (entry.isFile()) {
                const ext = pathModule.extname(entry.name).toLowerCase();
                if (this.supportedExtensions.includes(ext)) {
                    console.log('[WorkspaceScanner] Found file:', fullPath);
                    files.push(fullPath);
                }
            }
        }
    }

    /**
     * Check if a directory should be skipped during scanning
     * @param {string} dirName - Directory name (lowercase)
     * @returns {boolean}
     */
    shouldSkipDirectory(dirName) {
        const skipDirectories = [
            '.git',
            '.svn',
            '.hg',
            'node_modules',
            'bower_components',
            'vendor',
            'dist',
            'build',
            'out',
            'bin',
            'obj',
            '.vscode',
            '.idea',
            '__pycache__',
            '.cache',
            'temp',
            'tmp'
        ];

        return skipDirectories.includes(dirName);
    }

    /**
     * Scan a single file to check if it's supported
     * @param {string} filePath - File path to check
     * @returns {boolean} - True if file is supported and not ignored
     */
    isSupportedFile(filePath) {
        const ext = pathModule.extname(filePath).toLowerCase();
        if (!this.supportedExtensions.includes(ext)) {
            return false;
        }

        if (this.ignoreParser.isIgnored(filePath)) {
            return false;
        }

        return true;
    }

    /**
     * Reload .buraqignore patterns
     */
    reloadIgnorePatterns() {
        this.ignoreParser.load();
    }

    /**
     * Get the ignore parser instance
     * @returns {BuraqIgnoreParser}
     */
    getIgnoreParser() {
        return this.ignoreParser;
    }
}

module.exports = { WorkspaceScanner };
