'use strict';
const vscode = require('vscode');

/**
 * MQL Code Lens Provider
 * Shows reference counts above functions and classes
 */

// Cache for reference counts to avoid recalculating every time
let referenceCache = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Count references to a symbol across the workspace
 */
async function countReferences(symbolName) {
    const cacheKey = symbolName;
    const now = Date.now();

    // Check cache first
    if (now - lastCacheUpdate < CACHE_TTL && referenceCache.has(cacheKey)) {
        return referenceCache.get(cacheKey);
    }

    let count = 0;

    try {
        const files = await vscode.workspace.findFiles('**/*.{mq4,mq5,mqh}', '**/node_modules/**', 50);

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();

                // Simple word boundary search
                const regex = new RegExp('\\b' + escapeRegex(symbolName) + '\\b', 'g');
                const matches = text.match(regex);

                if (matches) {
                    count += matches.length;
                }
            } catch (e) {
                // Skip files that can't be read
            }
        }

        // Subtract 1 for the definition itself
        if (count > 0) {
            count -= 1;
        }

        referenceCache.set(cacheKey, count);
        lastCacheUpdate = now;

    } catch (e) {
        console.error('Error counting references:', e);
    }

    return count;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse document for function/class definitions
 */
function findSymbols(document) {
    const symbols = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments and preprocessor
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') ||
            trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

        // Match function definitions: type name(
        const funcMatch = trimmed.match(/^(?:static\s+|virtual\s+|const\s+|inline\s+|export\s+)*(void|int|double|float|string|bool|char|short|long|uchar|ushort|uint|ulong|color|datetime|ENUM_\w+|\w+)\s+(\w+)\s*\(/);
        if (funcMatch) {
            const name = funcMatch[2];
            // Skip control statements
            if (!['if', 'for', 'while', 'switch', 'do'].includes(name)) {
                const col = line.indexOf(name);
                symbols.push({
                    name: name,
                    line: i,
                    col: col >= 0 ? col : 0,
                    type: 'function'
                });
            }
        }

        // Match class definitions
        const classMatch = trimmed.match(/^class\s+(\w+)/);
        if (classMatch) {
            const name = classMatch[1];
            const col = line.indexOf(name);
            symbols.push({
                name: name,
                line: i,
                col: col >= 0 ? col : 0,
                type: 'class'
            });
        }

        // Match struct definitions
        const structMatch = trimmed.match(/^struct\s+(\w+)/);
        if (structMatch) {
            const name = structMatch[1];
            const col = line.indexOf(name);
            symbols.push({
                name: name,
                line: i,
                col: col >= 0 ? col : 0,
                type: 'struct'
            });
        }
    }

    return symbols;
}

/**
 * Create Code Lens Provider
 */
function createCodeLensProvider() {
    return {
        provideCodeLenses(document, token) {
            const lenses = [];

            // Check if file is MQL
            const ext = document.fileName.toLowerCase();
            if (!ext.endsWith('.mq4') && !ext.endsWith('.mq5') && !ext.endsWith('.mqh')) {
                return lenses;
            }

            const symbols = findSymbols(document);

            for (const symbol of symbols) {
                if (token.isCancellationRequested) break;

                const range = new vscode.Range(symbol.line, symbol.col, symbol.line, symbol.col + symbol.name.length);

                const lens = new vscode.CodeLens(range);
                lens._symbolName = symbol.name;
                lens._symbolType = symbol.type;
                lenses.push(lens);
            }

            return lenses;
        },

        async resolveCodeLens(lens, token) {
            if (token.isCancellationRequested) return lens;

            const count = await countReferences(lens._symbolName);

            lens.command = {
                title: count === 0 ? 'no references' :
                    count === 1 ? '1 reference' :
                        `${count} references`,
                command: 'editor.action.findReferences',
                arguments: [
                    vscode.window.activeTextEditor?.document.uri,
                    lens.range.start
                ],
                tooltip: 'Find all references'
            };

            return lens;
        }
    };
}

/**
 * Clear reference cache
 */
function clearReferenceCache() {
    referenceCache.clear();
    lastCacheUpdate = 0;
}

module.exports = {
    createCodeLensProvider,
    clearReferenceCache,
    countReferences
};
