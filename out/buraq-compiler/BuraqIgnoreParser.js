'use strict';

const fs = require('fs');
const pathModule = require('path');
const vscode = require('vscode');

/**
 * BuraqIgnoreParser - Parses .vscode/.buraqignore files
 * Works like .gitignore to exclude files from compilation
 */
class BuraqIgnoreParser {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.ignorePatterns = [];
        this.negationPatterns = [];
        this.buraqIgnorePath = pathModule.join(workspaceRoot, '.vscode', '.buraqignore');
        this.load();
    }

    /**
     * Load and parse .buraqignore file
     */
    load() {
        this.ignorePatterns = [];
        this.negationPatterns = [];

        if (!fs.existsSync(this.buraqIgnorePath)) {
            return;
        }

        try {
            const content = fs.readFileSync(this.buraqIgnorePath, 'utf8');
            const lines = content.split(/\r?\n/);

            lines.forEach((line, index) => {
                line = line.trim();

                // Skip empty lines and comments
                if (!line || line.startsWith('#')) {
                    return;
                }

                // Handle negation patterns (lines starting with !)
                if (line.startsWith('!')) {
                    const pattern = this.convertPattern(line.substring(1));
                    if (pattern) {
                        this.negationPatterns.push({
                            pattern: pattern,
                            original: line,
                            line: index + 1
                        });
                    }
                } else {
                    const pattern = this.convertPattern(line);
                    if (pattern) {
                        this.ignorePatterns.push({
                            pattern: pattern,
                            original: line,
                            line: index + 1
                        });
                    }
                }
            });

            console.log('[BuraqIgnore] Loaded', this.ignorePatterns.length, 'ignore patterns and', this.negationPatterns.length, 'negation patterns');
        } catch (error) {
            console.error('[BuraqIgnore] Failed to load .buraqignore:', error.message);
        }
    }

    /**
     * Convert .gitignore-style pattern to RegExp
     */
    convertPattern(pattern) {
        if (!pattern) {
            return null;
        }

        // Escape special regex characters except * and ?
        let regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '§§DOUBLESTAR§§')
            .replace(/\*/g, '[^/\\\\]*')
            .replace(/§§DOUBLESTAR§§/g, '.*')
            .replace(/\?/g, '.');

        // Handle directory-only patterns (ending with /)
        const isDirectoryOnly = pattern.endsWith('/');
        if (isDirectoryOnly) {
            regexPattern = regexPattern.replace(/\/$/, '');
        }

        // Handle patterns starting with /
        const isAnchored = pattern.startsWith('/');
        if (isAnchored) {
            regexPattern = regexPattern.substring(1);
        }

        // Build the final regex
        if (isAnchored) {
            regexPattern = '^' + regexPattern;
        } else {
            // Pattern can match at any directory level
            regexPattern = '(^|[/\\\\])' + regexPattern;
        }

        if (isDirectoryOnly) {
            regexPattern = regexPattern + '[/\\\\]';
        } else {
            // Pattern matches the file/path or any subpath
            regexPattern = regexPattern + '($|[/\\\\])';
        }

        try {
            return new RegExp(regexPattern, 'i');
        } catch (error) {
            console.error('[BuraqIgnore] Invalid pattern:', pattern, error.message);
            return null;
        }
    }

    /**
     * Check if a file path should be ignored
     * @param {string} filePath - Absolute file path to check
     * @returns {boolean} - True if file should be ignored
     */
    isIgnored(filePath) {
        if (!this.workspaceRoot || !filePath) {
            return false;
        }

        // Normalize path
        let normalizedPath = filePath;
        if (normalizedPath.startsWith(this.workspaceRoot)) {
            normalizedPath = normalizedPath.substring(this.workspaceRoot.length);
        }
        normalizedPath = normalizedPath.replace(/\\/g, '/').replace(/^\//, '');

        // Check negation patterns first (they take precedence)
        for (const negation of this.negationPatterns) {
            if (negation.pattern.test(normalizedPath)) {
                console.log('[BuraqIgnore] File NOT ignored (negated):', filePath, 'matched:', negation.original);
                return false;
            }
        }

        // Check ignore patterns
        for (const ignore of this.ignorePatterns) {
            if (ignore.pattern.test(normalizedPath)) {
                console.log('[BuraqIgnore] File ignored:', filePath, 'matched:', ignore.original);
                return true;
            }
        }

        return false;
    }

    /**
     * Check if .buraqignore file exists
     * @returns {boolean}
     */
    exists() {
        return fs.existsSync(this.buraqIgnorePath);
    }

    /**
     * Get the path to .buraqignore file
     * @returns {string}
     */
    getPath() {
        return this.buraqIgnorePath;
    }

    /**
     * Get all loaded patterns (for debugging)
     * @returns {Object}
     */
    getPatterns() {
        return {
            ignore: this.ignorePatterns.map(p => p.original),
            negation: this.negationPatterns.map(p => p.original)
        };
    }
}

module.exports = { BuraqIgnoreParser };
