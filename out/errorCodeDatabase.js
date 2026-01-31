'use strict';
const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');

/**
 * MQL Error Code Database
 * Provides hover information for MQL error codes
 */

let errorDatabase = null;

/**
 * Load error code database
 */
function loadErrorDatabase() {
    if (errorDatabase) return errorDatabase;

    try {
        const dbPath = pathModule.join(__dirname, '..', 'mql-data', 'error-codes.json');
        const content = fs.readFileSync(dbPath, 'utf8');
        errorDatabase = JSON.parse(content);
    } catch (e) {
        console.error('Failed to load error code database:', e);
        errorDatabase = { runtime_errors: {}, mql_errors: {}, error_constants: {} };
    }

    return errorDatabase;
}

/**
 * Get error description by code number
 */
function getErrorByNumber(code) {
    const db = loadErrorDatabase();
    const codeStr = String(code);

    if (db.runtime_errors[codeStr]) {
        return db.runtime_errors[codeStr];
    }
    if (db.mql_errors[codeStr]) {
        return db.mql_errors[codeStr];
    }

    return null;
}

/**
 * Get error description by constant name
 */
function getErrorByName(name) {
    const db = loadErrorDatabase();

    if (db.error_constants[name]) {
        return db.error_constants[name];
    }

    // Search in runtime_errors and mql_errors
    for (const key in db.runtime_errors) {
        if (db.runtime_errors[key].code === name) {
            return { ...db.runtime_errors[key], code: parseInt(key) };
        }
    }
    for (const key in db.mql_errors) {
        if (db.mql_errors[key].code === name) {
            return { ...db.mql_errors[key], code: parseInt(key) };
        }
    }

    return null;
}

/**
 * Create hover provider for error codes
 */
function createErrorCodeHoverProvider() {
    return {
        provideHover(document, position, token) {
            const wordRange = document.getWordRangeAtPosition(position, /ERR_[A-Z_]+|\d+/);
            if (!wordRange) return null;

            const word = document.getText(wordRange);
            let errorInfo = null;

            // Check if it's an error constant (ERR_*)
            if (word.startsWith('ERR_')) {
                errorInfo = getErrorByName(word);
            }
            // Check if it's a number (error code)
            else if (/^\d+$/.test(word)) {
                const code = parseInt(word);
                // Only show for likely error codes (common ranges)
                if (code === 0 || (code >= 1 && code <= 200) || (code >= 4000 && code <= 6000)) {
                    errorInfo = getErrorByNumber(code);
                }
            }

            if (!errorInfo) return null;

            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**MQL Error Code**\n\n`);

            if (typeof errorInfo.code === 'number') {
                markdown.appendMarkdown(`**Code:** \`${errorInfo.code}\`\n\n`);
            }
            if (errorInfo.code && typeof errorInfo.code === 'string') {
                markdown.appendMarkdown(`**Constant:** \`${errorInfo.code}\`\n\n`);
            }
            markdown.appendMarkdown(`**Description:** ${errorInfo.description}`);

            return new vscode.Hover(markdown, wordRange);
        }
    };
}

module.exports = {
    createErrorCodeHoverProvider,
    getErrorByNumber,
    getErrorByName,
    loadErrorDatabase
};
