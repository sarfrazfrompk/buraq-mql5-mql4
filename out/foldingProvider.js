'use strict';
const vscode = require('vscode');

/**
 * MQL Folding Range Provider
 * Provides code folding for brace-based blocks, #region, #ifdef, and comments
 */
function createFoldingRangeProvider() {
    return {
        provideFoldingRanges(document, context, token) {
            const ranges = [];
            const text = document.getText();
            const lines = text.split(/\r?\n/);

            // Track block starts for brace-based folding
            const braceStack = []; // {line, col} where { appears
            const regionStack = []; // line numbers for #region
            const ifdefStack = []; // line numbers for #ifdef

            let inBlockComment = false;
            let blockCommentStart = -1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Handle block comments /* ... */
                if (!inBlockComment && trimmed.startsWith('/*')) {
                    inBlockComment = true;
                    blockCommentStart = i;
                }

                if (inBlockComment) {
                    if (trimmed.includes('*/')) {
                        inBlockComment = false;
                        if (i > blockCommentStart) {
                            // Fold from start to line BEFORE the closing */
                            // so closing */ is visible
                            ranges.push(new vscode.FoldingRange(
                                blockCommentStart, i,
                                vscode.FoldingRangeKind.Comment
                            ));
                        }
                        blockCommentStart = -1;
                    }
                    continue;
                }

                // Skip empty lines for other checks
                if (!trimmed) continue;

                // Handle #region / #endregion
                if (trimmed.match(/^\/\/\s*#?region\b/i) || trimmed.match(/^#region\b/i)) {
                    regionStack.push(i);
                    continue;
                }

                if (trimmed.match(/^\/\/\s*#?endregion\b/i) || trimmed.match(/^#endregion\b/i)) {
                    if (regionStack.length > 0) {
                        const startLine = regionStack.pop();
                        if (i > startLine) {
                            ranges.push(new vscode.FoldingRange(
                                startLine, i,
                                vscode.FoldingRangeKind.Region
                            ));
                        }
                    }
                    continue;
                }

                // Handle #ifdef / #ifndef / #if / #endif
                if (trimmed.match(/^#if(def|ndef)?\b/)) {
                    ifdefStack.push(i);
                    continue;
                }

                if (trimmed.startsWith('#endif')) {
                    if (ifdefStack.length > 0) {
                        const startLine = ifdefStack.pop();
                        if (i > startLine) {
                            ranges.push(new vscode.FoldingRange(
                                startLine, i,
                                vscode.FoldingRangeKind.Region
                            ));
                        }
                    }
                    continue;
                }

                // Handle braces - simple approach
                // Count braces on this line, ignoring those in strings/comments
                const cleanLine = removeStringsAndComments(line);

                for (let j = 0; j < cleanLine.length; j++) {
                    if (cleanLine[j] === '{') {
                        braceStack.push(i);
                    } else if (cleanLine[j] === '}') {
                        if (braceStack.length > 0) {
                            const startLine = braceStack.pop();
                            // Only create fold if it spans multiple lines
                            // End at line BEFORE the closing brace so } stays visible
                            if (i > startLine + 1) {
                                ranges.push(new vscode.FoldingRange(
                                    startLine, i - 1,
                                    vscode.FoldingRangeKind.Region
                                ));
                            } else if (i > startLine) {
                                // If only one line between, fold from opening brace line
                                ranges.push(new vscode.FoldingRange(
                                    startLine, i - 1,
                                    vscode.FoldingRangeKind.Region
                                ));
                            }
                        }
                    }
                }
            }

            return ranges;
        }
    };
}

/**
 * Remove string literals and comments from a line for safe brace counting
 */
function removeStringsAndComments(line) {
    let result = '';
    let inString = false;
    let stringChar = '';
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = i + 1 < line.length ? line[i + 1] : '';
        const prevChar = i > 0 ? line[i - 1] : '';

        // Handle single-line comment
        if (!inString && char === '/' && nextChar === '/') {
            break; // Rest of line is comment
        }

        // Handle string start/end
        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
            i++;
            continue;
        }

        // Only add non-string characters
        if (!inString) {
            result += char;
        }

        i++;
    }

    return result;
}

module.exports = {
    createFoldingRangeProvider
};
