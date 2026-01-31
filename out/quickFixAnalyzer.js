'use strict';
const vscode = require('vscode');

/**
 * MQL Quick Fix Analyzer
 * Analyzes MQL code independently without relying on compiler diagnostics
 */

/**
 * Issue types that can be detected and fixed
 */
const IssueType = {
    MISSING_SEMICOLON: 'missing_semicolon',
    DUPLICATE_SEMICOLON: 'duplicate_semicolon',
    TRAILING_WHITESPACE: 'trailing_whitespace'
};

/**
 * Represents a detected issue in the code
 */
class CodeIssue {
    constructor(lineNum, type, description, fix) {
        this.lineNum = lineNum;
        this.type = type;
        this.description = description;
        this.fix = fix; // Function that returns the fixed line text
    }
}

/**
 * Analyze a document and find all fixable issues
 * @param {vscode.TextDocument} document 
 * @returns {CodeIssue[]} Array of detected issues
 */
function analyzeDocument(document) {
    const issues = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Track brace depth for context
    let braceDepth = 0;
    let inBlockComment = false;
    let inString = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (trimmed.length === 0) continue;

        // Handle block comments
        if (trimmed.startsWith('/*')) {
            inBlockComment = true;
        }
        if (inBlockComment) {
            if (trimmed.includes('*/')) {
                inBlockComment = false;
            }
            continue;
        }

        // Skip single-line comments
        if (trimmed.startsWith('//')) continue;

        // Skip preprocessor directives
        if (trimmed.startsWith('#')) continue;

        // Get the code part (before any inline comment)
        const commentIdx = line.indexOf('//');
        const codePart = commentIdx >= 0 ? line.substring(0, commentIdx).trimEnd() : line.trimEnd();
        const codePartTrimmed = codePart.trim();

        // Skip if no code
        if (codePartTrimmed.length === 0) continue;

        // Track braces
        const cleanCode = removeStrings(codePartTrimmed);
        for (const char of cleanCode) {
            if (char === '{') braceDepth++;
            if (char === '}') braceDepth--;
        }

        // Check for missing semicolons
        const missingSemicolon = checkMissingSemicolon(codePartTrimmed, braceDepth, i, lines);
        if (missingSemicolon) {
            issues.push(new CodeIssue(
                i,
                IssueType.MISSING_SEMICOLON,
                'Missing semicolon',
                () => codePart + ';' + (commentIdx >= 0 ? ' ' + line.substring(commentIdx) : '')
            ));
        }

        // Check for duplicate semicolons
        if (codePartTrimmed.includes(';;')) {
            issues.push(new CodeIssue(
                i,
                IssueType.DUPLICATE_SEMICOLON,
                'Duplicate semicolon',
                () => line.replace(';;', ';')
            ));
        }
    }

    return issues;
}

/**
 * Check if a line is missing a semicolon
 */
function checkMissingSemicolon(codeLine, braceDepth, lineNum, allLines) {
    // Lines that definitely don't need semicolons
    if (codeLine.endsWith(';')) return false;
    if (codeLine.endsWith('{')) return false;
    if (codeLine.endsWith('}')) return false;
    if (codeLine.endsWith(':')) return false;
    if (codeLine.endsWith(',')) return false;
    if (codeLine.endsWith('(')) return false;
    if (codeLine.endsWith('\\')) return false; // Line continuation

    // Control structures don't need semicolons
    if (codeLine.match(/^(if|else|for|while|switch|do)\s*\(/)) return false;
    if (codeLine.match(/^(if|else|for|while|switch|do)\s*$/)) return false;
    if (codeLine === 'else') return false;
    if (codeLine === 'do') return false;

    // Class/struct/enum declarations
    if (codeLine.match(/^(class|struct|enum)\s+\w+/)) return false;

    // Function declarations (have { on next line or same line)
    if (codeLine.match(/\)\s*$/)) {
        // Check if next line starts with {
        if (lineNum + 1 < allLines.length) {
            const nextLine = allLines[lineNum + 1].trim();
            if (nextLine.startsWith('{')) {
                return false; // It's a function declaration
            }
        }

        // Check if it looks like a function definition (has return type before it)
        if (codeLine.match(/^(void|int|double|float|string|bool|char|short|long|uchar|ushort|uint|ulong|color|datetime|ENUM_\w+|\w+)\s+\w+\s*\([^)]*\)\s*$/)) {
            return false; // Function declaration
        }

        // If it's just a function call like FunctionName() or obj.Method()
        // or a statement like return FunctionCall()
        if (codeLine.match(/^\w+(\.\w+)*\s*\([^)]*\)\s*$/) ||
            codeLine.match(/^return\s+.*\)\s*$/) ||
            codeLine.match(/=\s*\w+\s*\([^)]*\)\s*$/)) {
            return true; // Needs semicolon
        }
    }

    // Assignment statements need semicolons
    if (codeLine.match(/=\s*[^=].*[^;{}\s]$/)) {
        return true;
    }

    // Variable declarations need semicolons
    if (codeLine.match(/^(int|double|float|string|bool|char|short|long|uchar|ushort|uint|ulong|color|datetime)\s+\w+\s*=?.*[^;{}\s]$/)) {
        return true;
    }

    // Return statements need semicolons
    if (codeLine.match(/^return\s+.+[^;]$/)) {
        return true;
    }

    // Break/continue need semicolons
    if (codeLine === 'break' || codeLine === 'continue') {
        return true;
    }

    return false;
}

/**
 * Remove string literals from code for safe parsing
 */
function removeStrings(code) {
    let result = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const prevChar = i > 0 ? code[i - 1] : '';

        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
            continue;
        }

        if (!inString) {
            result += char;
        }
    }

    return result;
}

/**
 * Apply all fixes to a document
 * @param {vscode.TextDocument} document 
 * @returns {Promise<number>} Number of fixes applied
 */
async function applyAllFixes(document) {
    const issues = analyzeDocument(document);

    if (issues.length === 0) {
        return 0;
    }

    const edit = new vscode.WorkspaceEdit();
    const fixedLines = new Set();
    let fixCount = 0;

    for (const issue of issues) {
        // Only fix each line once
        if (fixedLines.has(issue.lineNum)) continue;

        const line = document.lineAt(issue.lineNum);
        const fixedText = issue.fix();

        // Only apply if the fix is different
        if (fixedText !== line.text) {
            edit.replace(document.uri, line.range, fixedText);
            fixedLines.add(issue.lineNum);
            fixCount++;
        }
    }

    if (fixCount > 0) {
        await vscode.workspace.applyEdit(edit);
    }

    return fixCount;
}

module.exports = {
    analyzeDocument,
    applyAllFixes,
    IssueType,
    CodeIssue
};
