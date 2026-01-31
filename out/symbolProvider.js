'use strict';
const vscode = require('vscode');
const pathModule = require('path');
const fs = require('fs');

// Symbol cache for workspace
let symbolCache = new Map(); // Map<filePath, { symbols, version }>

// MQL Symbol types
const MQL_SYMBOL_KINDS = {
    FUNCTION: vscode.SymbolKind.Function,
    CLASS: vscode.SymbolKind.Class,
    STRUCT: vscode.SymbolKind.Struct,
    ENUM: vscode.SymbolKind.Enum,
    ENUM_MEMBER: vscode.SymbolKind.EnumMember,
    VARIABLE: vscode.SymbolKind.Variable,
    CONSTANT: vscode.SymbolKind.Constant,
    PROPERTY: vscode.SymbolKind.Property,
    METHOD: vscode.SymbolKind.Method
};

// Reserved words/types to skip
const RESERVED_WORDS = new Set([
    'void', 'int', 'double', 'float', 'string', 'bool', 'char', 'short', 'long',
    'uchar', 'ushort', 'uint', 'ulong', 'color', 'datetime', 'return', 'if',
    'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default',
    'true', 'false', 'NULL', 'EMPTY', 'CLR_NONE', 'WRONG_VALUE',
    'const', 'static', 'extern', 'input', 'sinput', 'virtual', 'override',
    'public', 'private', 'protected', 'new', 'delete', 'this',
    'sizeof', 'operator', 'namespace', 'using', 'export', 'inline'
]);

// Type keywords (can appear as return types)
const TYPE_KEYWORDS = new Set([
    'void', 'int', 'double', 'float', 'string', 'bool', 'char', 'short', 'long',
    'uchar', 'ushort', 'uint', 'ulong', 'color', 'datetime', 'ENUM_TIMEFRAMES'
]);

/**
 * Symbol information structure
 */
class MQLSymbol {
    constructor(name, kind, range, selectionRange, containerName = '', detail = '', filePath = '') {
        this.name = name;
        this.kind = kind;
        this.range = range;
        this.selectionRange = selectionRange;
        this.containerName = containerName;
        this.detail = detail;
        this.filePath = filePath;
        this.children = [];
    }

    toDocumentSymbol() {
        const symbol = new vscode.DocumentSymbol(
            this.name,
            this.detail,
            this.kind,
            this.range,
            this.selectionRange
        );
        symbol.children = this.children.map(c => c.toDocumentSymbol());
        return symbol;
    }

    toSymbolInformation() {
        return new vscode.SymbolInformation(
            this.name,
            this.kind,
            this.containerName,
            new vscode.Location(vscode.Uri.file(this.filePath), this.range)
        );
    }
}

/**
 * Parse a document and extract all symbols
 */
function parseDocument(document) {
    const text = document.getText();
    const symbols = [];
    const lines = text.split(/\r?\n/);

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) continue;

        // Parse #define constants
        const defineMatch = trimmedLine.match(/^#define\s+(\w+)/);
        if (defineMatch) {
            const name = defineMatch[1];
            const startCol = line.indexOf(name);
            if (startCol >= 0) {
                const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                const selRange = new vscode.Range(lineNum, startCol, lineNum, startCol + name.length);
                symbols.push(new MQLSymbol(name, MQL_SYMBOL_KINDS.CONSTANT, range, selRange, '', '#define', document.fileName));
            }
            continue;
        }

        // Parse class declarations
        const classMatch = trimmedLine.match(/^class\s+(\w+)/);
        if (classMatch) {
            const name = classMatch[1];
            const startCol = line.indexOf(name);
            if (startCol >= 0) {
                const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                const selRange = new vscode.Range(lineNum, startCol, lineNum, startCol + name.length);
                symbols.push(new MQLSymbol(name, MQL_SYMBOL_KINDS.CLASS, range, selRange, '', 'class', document.fileName));
            }
            continue;
        }

        // Parse struct declarations
        const structMatch = trimmedLine.match(/^struct\s+(\w+)/);
        if (structMatch) {
            const name = structMatch[1];
            const startCol = line.indexOf(name);
            if (startCol >= 0) {
                const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                const selRange = new vscode.Range(lineNum, startCol, lineNum, startCol + name.length);
                symbols.push(new MQLSymbol(name, MQL_SYMBOL_KINDS.STRUCT, range, selRange, '', 'struct', document.fileName));
            }
            continue;
        }

        // Parse enum declarations
        const enumMatch = trimmedLine.match(/^enum\s+(\w+)/);
        if (enumMatch) {
            const name = enumMatch[1];
            const startCol = line.indexOf(name);
            if (startCol >= 0) {
                const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                const selRange = new vscode.Range(lineNum, startCol, lineNum, startCol + name.length);
                symbols.push(new MQLSymbol(name, MQL_SYMBOL_KINDS.ENUM, range, selRange, '', 'enum', document.fileName));
            }
            continue;
        }

        // Parse input/extern variables
        const inputMatch = trimmedLine.match(/^(input|extern|sinput)\s+(\w+)\s+(\w+)/);
        if (inputMatch) {
            const modifier = inputMatch[1];
            const type = inputMatch[2];
            const name = inputMatch[3];
            if (!RESERVED_WORDS.has(name)) {
                const startCol = line.lastIndexOf(name);
                if (startCol >= 0) {
                    const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                    const selRange = new vscode.Range(lineNum, startCol, lineNum, startCol + name.length);
                    symbols.push(new MQLSymbol(name, MQL_SYMBOL_KINDS.PROPERTY, range, selRange, '', `${modifier} ${type}`, document.fileName));
                }
            }
            continue;
        }

        // Parse function declarations - more flexible regex
        // Matches: [modifiers] type name(...)
        // The key is to find "name(" pattern after a type keyword
        if (trimmedLine.includes('(') && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('if') &&
            !trimmedLine.startsWith('for') && !trimmedLine.startsWith('while') && !trimmedLine.startsWith('switch')) {

            // Match function pattern: words before parenthesis
            const funcPattern = /(?:^|\s)(static\s+|virtual\s+|const\s+|inline\s+|export\s+)*(\w+)\s+(\w+)\s*\(/;
            const funcMatch = trimmedLine.match(funcPattern);

            if (funcMatch) {
                const returnType = funcMatch[2];
                const name = funcMatch[3];

                // Skip if name is a reserved word or if it looks like a control statement
                if (!RESERVED_WORDS.has(name) && (TYPE_KEYWORDS.has(returnType) || !RESERVED_WORDS.has(returnType))) {
                    // Find the position of the function name in the original line
                    const nameWithParen = name + '(';
                    const nameWithSpace = name + ' (';
                    let startCol = line.indexOf(nameWithParen);
                    if (startCol < 0) startCol = line.indexOf(nameWithSpace);
                    if (startCol < 0) {
                        // Fall back to finding the name
                        const regex = new RegExp('\\b' + name + '\\b');
                        const match = line.match(regex);
                        if (match) startCol = match.index;
                    }

                    if (startCol >= 0) {
                        const range = new vscode.Range(lineNum, 0, lineNum, line.length);
                        const selRange = new vscode.Range(lineNum, startCol, lineNum, startCol + name.length);
                        const detail = `${returnType}()`;
                        symbols.push(new MQLSymbol(name, MQL_SYMBOL_KINDS.FUNCTION, range, selRange, '', detail, document.fileName));
                    }
                }
            }
        }
    }

    return symbols;
}

/**
 * Get symbols from cache or parse document - ALWAYS re-parse for fresh results
 */
function getDocumentSymbols(document) {
    // Always parse to ensure fresh results
    const symbols = parseDocument(document);
    symbolCache.set(document.fileName, { symbols, version: document.version });
    return symbols;
}

/**
 * Scan workspace for MQL files and cache their symbols
 */
async function scanWorkspace() {
    try {
        const files = await vscode.workspace.findFiles('**/*.{mq4,mq5,mqh}', '**/node_modules/**', 200);

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const symbols = parseDocument(document);
                symbolCache.set(document.fileName, { symbols, version: document.version });
            } catch (e) {
                // Skip files that can't be opened
            }
        }
    } catch (e) {
        console.error('Error scanning workspace:', e);
    }
}

/**
 * Find symbol definition by name in a specific document
 */
function findDefinitionInDocument(document, name) {
    const symbols = getDocumentSymbols(document);

    for (const symbol of symbols) {
        if (symbol.name === name) {
            return new vscode.Location(document.uri, symbol.selectionRange);
        }
    }
    return null;
}

/**
 * Find all definitions in workspace
 */
async function findDefinitionInWorkspace(name) {
    await scanWorkspace();
    const results = [];

    for (const [filePath, cached] of symbolCache) {
        for (const symbol of cached.symbols) {
            if (symbol.name === name) {
                results.push(new vscode.Location(vscode.Uri.file(filePath), symbol.selectionRange));
            }
        }
    }

    return results;
}

/**
 * Find all references to a symbol - exact word matches only
 */
async function findReferences(document, position, name, includeDeclaration = true) {
    const results = [];

    try {
        const files = await vscode.workspace.findFiles('**/*.{mq4,mq5,mqh}', '**/node_modules/**', 200);

        for (const file of files) {
            try {
                const doc = await vscode.workspace.openTextDocument(file);
                const text = doc.getText();
                const lines = text.split(/\r?\n/);

                for (let lineNum = 0; lineNum < lines.length; lineNum++) {
                    const line = lines[lineNum];
                    const trimmed = line.trim();

                    // Skip comment lines
                    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
                        continue;
                    }

                    // Find exact word matches only
                    const regex = new RegExp('\\b' + escapeRegex(name) + '\\b', 'g');
                    let match;

                    while ((match = regex.exec(line)) !== null) {
                        const col = match.index;

                        // Check not inside string
                        if (isInsideString(line, col)) continue;

                        // Check not inside single-line comment
                        const commentIdx = line.indexOf('//');
                        if (commentIdx >= 0 && col > commentIdx) continue;

                        const range = new vscode.Range(lineNum, col, lineNum, col + name.length);
                        results.push(new vscode.Location(doc.uri, range));
                    }
                }
            } catch (e) {
                // Skip files that can't be read
            }
        }
    } catch (e) {
        console.error('Error finding references:', e);
    }

    return results;
}

/**
 * Check if position is inside a string literal
 */
function isInsideString(line, col) {
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < col && i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';

        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
    }

    return inString;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get word at cursor position
 */
function getWordAtPosition(document, position) {
    const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
    return range ? document.getText(range) : null;
}

// ============ PROVIDERS ============

/**
 * Definition Provider - Go To Definition (Ctrl+Click)
 */
function createDefinitionProvider() {
    return {
        async provideDefinition(document, position, token) {
            const word = getWordAtPosition(document, position);
            if (!word || RESERVED_WORDS.has(word) || word.length < 2) return null;

            // First check current document
            const localDef = findDefinitionInDocument(document, word);
            if (localDef) {
                return localDef;
            }

            // Then check workspace
            const workspaceDefs = await findDefinitionInWorkspace(word);
            if (workspaceDefs.length === 1) {
                return workspaceDefs[0];
            } else if (workspaceDefs.length > 1) {
                return workspaceDefs;
            }

            return null;
        }
    };
}

/**
 * Reference Provider - Find All References
 */
function createReferenceProvider() {
    return {
        async provideReferences(document, position, context, token) {
            const word = getWordAtPosition(document, position);
            if (!word || RESERVED_WORDS.has(word) || word.length < 2) return [];

            return await findReferences(document, position, word, context.includeDeclaration);
        }
    };
}

/**
 * Document Symbol Provider - Outline View
 */
function createDocumentSymbolProvider() {
    return {
        provideDocumentSymbols(document, token) {
            const symbols = getDocumentSymbols(document);
            return symbols.map(s => s.toDocumentSymbol());
        }
    };
}

/**
 * Workspace Symbol Provider - Ctrl+T search
 */
function createWorkspaceSymbolProvider() {
    return {
        async provideWorkspaceSymbols(query, token) {
            await scanWorkspace();

            const results = [];
            const lowerQuery = query.toLowerCase();

            for (const [filePath, cached] of symbolCache) {
                for (const symbol of cached.symbols) {
                    if (!query || symbol.name.toLowerCase().includes(lowerQuery)) {
                        results.push(symbol.toSymbolInformation());
                    }
                }
            }

            return results;
        }
    };
}

/**
 * Rename Provider - Refactor symbols
 */
function createRenameProvider() {
    return {
        prepareRename(document, position, token) {
            const word = getWordAtPosition(document, position);
            if (!word || RESERVED_WORDS.has(word) || word.length < 2) {
                throw new Error('Cannot rename this element');
            }

            const range = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
            return { range, placeholder: word };
        },

        async provideRenameEdits(document, position, newName, token) {
            const word = getWordAtPosition(document, position);
            if (!word) return null;

            // Validate new name
            if (!newName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                throw new Error('Invalid identifier name');
            }

            const references = await findReferences(document, position, word, true);
            const edit = new vscode.WorkspaceEdit();

            for (const ref of references) {
                edit.replace(ref.uri, ref.range, newName);
            }

            return edit;
        }
    };
}

/**
 * Clear symbol cache for a document
 */
function invalidateCache(document) {
    if (document && document.fileName) {
        symbolCache.delete(document.fileName);
    }
}

/**
 * Clear all cached symbols
 */
function clearCache() {
    symbolCache.clear();
}

module.exports = {
    createDefinitionProvider,
    createReferenceProvider,
    createDocumentSymbolProvider,
    createWorkspaceSymbolProvider,
    createRenameProvider,
    invalidateCache,
    clearCache,
    getDocumentSymbols,
    scanWorkspace
};
