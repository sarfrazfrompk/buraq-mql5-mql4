'use strict';
const vscode = require('vscode');
const pathModule = require('path');
const fs = require('fs');
const { detectAllIncludePaths } = require('./includePathDetector');

/**
 * Document Link Provider for MQL #include directives
 */
function createDocumentLinkProvider() {
    return {
        provideDocumentLinks(document, token) {
            const text = document.getText();
            const links = [];
            const includePattern = /#include\s+["<]([^">]+)[">]/g;
            let match;

            // Get configuration settings
            const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
            const include4Dir = config.get('Metaeditor.Include4Dir');
            const include5Dir = config.get('Metaeditor.Include5Dir');

            // Get detected paths as fallback
            const detectedPaths = detectAllIncludePaths();

            while ((match = includePattern.exec(text)) !== null) {
                const start = match.index;
                const end = match.index + match[0].length;
                const range = new vscode.Range(
                    document.positionAt(start),
                    document.positionAt(end)
                );

                // Extract the file path from the match
                // match[0] is full string e.g. #include <Trade\Trade.mqh>
                // match[1] is inner path e.g. Trade\Trade.mqh
                const rawPath = match[1];
                const isAngleBrackets = match[0].includes('<');

                let targetUri = null;

                // 1. Check relative to current file (Standard behavior for "file.mqh")
                // Even <file.mqh> sometimes works relatively in ME, but strictly it searches include path.
                // We check relative first for "..." style.
                if (!isAngleBrackets) {
                    const currentDir = pathModule.dirname(document.fileName);
                    const relativePath = pathModule.join(currentDir, rawPath);
                    if (fs.existsSync(relativePath)) {
                        targetUri = vscode.Uri.file(relativePath);
                    }
                }

                // 2. Check configured Include paths
                if (!targetUri) {
                    // Normalize slashes
                    const normalizedPath = rawPath.replace(/\//g, '\\');

                    const mqlVersion = pathModule.extname(document.fileName).toLowerCase() === '.mq4' ? 4 : 5;
                    const primaryIncludeDir = mqlVersion === 4 ? include4Dir : include5Dir;

                    if (primaryIncludeDir && fs.existsSync(pathModule.join(primaryIncludeDir, normalizedPath))) {
                        targetUri = vscode.Uri.file(pathModule.join(primaryIncludeDir, normalizedPath));
                    }

                    // Cross-check other version if not found (sometimes people share headers)
                    if (!targetUri) {
                        const secondaryIncludeDir = mqlVersion === 4 ? include5Dir : include4Dir;
                        if (secondaryIncludeDir && fs.existsSync(pathModule.join(secondaryIncludeDir, normalizedPath))) {
                            targetUri = vscode.Uri.file(pathModule.join(secondaryIncludeDir, normalizedPath));
                        }
                    }
                }

                // 3. Check detected system paths (fallback)
                if (!targetUri) {
                    const normalizedPath = rawPath.replace(/\//g, '\\');

                    // Check MT5 paths
                    for (const p of detectedPaths.mt5) {
                        const fullPath = pathModule.join(p.path, normalizedPath);
                        if (fs.existsSync(fullPath)) {
                            targetUri = vscode.Uri.file(fullPath);
                            break;
                        }
                    }

                    // Check MT4 paths if not found
                    if (!targetUri) {
                        for (const p of detectedPaths.mt4) {
                            const fullPath = pathModule.join(p.path, normalizedPath);
                            if (fs.existsSync(fullPath)) {
                                targetUri = vscode.Uri.file(fullPath);
                                break;
                            }
                        }
                    }
                }

                if (targetUri) {
                    links.push(new vscode.DocumentLink(range, targetUri));
                }
            }

            return links;
        }
    };
}

module.exports = {
    createDocumentLinkProvider
};
