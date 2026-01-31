'use strict';
const vscode = require('vscode');
const quickFixAnalyzer = require('./quickFixAnalyzer');

/**
 * MQL Code Action Provider
 * Provides quick fixes using INDEPENDENT analysis (no compiler needed)
 */

/**
 * Create Code Action Provider - uses independent analyzer
 */
function createCodeActionProvider() {
    return {
        provideCodeActions(document, range, context, token) {
            const actions = [];
            const lineNum = range.start.line;
            const line = document.lineAt(lineNum);
            const lineText = line.text;
            const trimmedLine = lineText.trim();

            // Skip empty lines
            if (trimmedLine.length === 0) return actions;

            // Use independent analyzer to detect issues on this line
            const issues = quickFixAnalyzer.analyzeDocument(document);

            // Find issues on the current line
            for (const issue of issues) {
                if (issue.lineNum === lineNum) {
                    if (issue.type === 'missing_semicolon') {
                        const fix = new vscode.CodeAction(
                            'Add missing semicolon',
                            vscode.CodeActionKind.QuickFix
                        );
                        fix.edit = new vscode.WorkspaceEdit();
                        fix.edit.replace(document.uri, line.range, issue.fix());
                        fix.isPreferred = true;
                        actions.push(fix);
                    } else if (issue.type === 'duplicate_semicolon') {
                        const fix = new vscode.CodeAction(
                            'Remove duplicate semicolon',
                            vscode.CodeActionKind.QuickFix
                        );
                        fix.edit = new vscode.WorkspaceEdit();
                        fix.edit.replace(document.uri, line.range, issue.fix());
                        fix.isPreferred = true;
                        actions.push(fix);
                    }
                }
            }

            // Add general code actions (refactoring)

            // Extract function from selection
            if (!range.isEmpty && range.start.line !== range.end.line) {
                const extractAction = new vscode.CodeAction(
                    'Extract to function',
                    vscode.CodeActionKind.RefactorExtract
                );
                extractAction.command = {
                    command: 'buraq_mql5_mql4.extractFunction',
                    title: 'Extract to function',
                    arguments: [document, range]
                };
                actions.push(extractAction);
            }

            // Add include guard for .mqh files
            if (document.fileName.endsWith('.mqh')) {
                const text = document.getText();
                if (!text.includes('#ifndef') && !text.includes('#define')) {
                    const guardAction = new vscode.CodeAction(
                        'Add include guard',
                        vscode.CodeActionKind.Source
                    );
                    guardAction.command = {
                        command: 'buraq_mql5_mql4.addIncludeGuard',
                        title: 'Add include guard',
                        arguments: [document]
                    };
                    actions.push(guardAction);
                }
            }

            // Wrap trading operations in error handling
            if (trimmedLine.includes('OrderSend') || trimmedLine.includes('PositionOpen') ||
                trimmedLine.includes('OrderModify') || trimmedLine.includes('OrderClose')) {
                const wrapAction = new vscode.CodeAction(
                    'Wrap in error handling',
                    vscode.CodeActionKind.Refactor
                );
                wrapAction.command = {
                    command: 'buraq_mql5_mql4.wrapInErrorHandling',
                    title: 'Wrap in error handling',
                    arguments: [document, range]
                };
                actions.push(wrapAction);
            }

            return actions;
        }
    };
}

/**
 * Get indentation of a line
 */
function getLineIndent(document, lineNum) {
    if (lineNum < 0 || lineNum >= document.lineCount) return '';

    const line = document.lineAt(lineNum).text;
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}

/**
 * Register additional commands used by code actions
 */
function registerCodeActionCommands(context) {
    // Extract to function command
    context.subscriptions.push(
        vscode.commands.registerCommand('buraq_mql5_mql4.extractFunction', async (document, range) => {
            const selectedText = document.getText(range);

            // Prompt for function name
            const funcName = await vscode.window.showInputBox({
                prompt: 'Enter function name',
                placeHolder: 'MyFunction',
                validateInput: (value) => {
                    if (!value || !value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                        return 'Invalid function name';
                    }
                    return null;
                }
            });

            if (!funcName) return;

            // Create the function
            const indent = getLineIndent(document, range.start.line);
            const funcCode = `\n${indent}void ${funcName}()\n${indent}{\n${selectedText.split('\n').map(l => indent + '   ' + l.trim()).join('\n')}\n${indent}}\n`;

            // Find end of file or before closing brace
            const insertPos = new vscode.Position(document.lineCount, 0);

            const edit = new vscode.WorkspaceEdit();

            // Replace selection with function call
            edit.replace(document.uri, range, `${indent}${funcName}();`);

            // Add function definition
            edit.insert(document.uri, insertPos, funcCode);

            await vscode.workspace.applyEdit(edit);
        })
    );

    // Add include guard command
    context.subscriptions.push(
        vscode.commands.registerCommand('buraq_mql5_mql4.addIncludeGuard', async (document) => {
            const fileName = document.fileName.split(/[/\\]/).pop().replace('.', '_').toUpperCase();
            const guardName = `__${fileName}__`;

            const edit = new vscode.WorkspaceEdit();

            // Add guard at beginning
            edit.insert(document.uri, new vscode.Position(0, 0),
                `#ifndef ${guardName}\n#define ${guardName}\n\n`);

            // Add endif at end
            const endPos = new vscode.Position(document.lineCount, 0);
            edit.insert(document.uri, endPos, `\n#endif // ${guardName}\n`);

            await vscode.workspace.applyEdit(edit);
        })
    );

    // Wrap in error handling command
    context.subscriptions.push(
        vscode.commands.registerCommand('buraq_mql5_mql4.wrapInErrorHandling', async (document, range) => {
            const line = document.lineAt(range.start.line);
            const lineText = line.text;
            const indent = getLineIndent(document, range.start.line);

            const wrappedCode = `${indent}if(${lineText.trim().replace(/;$/, '')})\n${indent}{\n${indent}   // Success\n${indent}}\n${indent}else\n${indent}{\n${indent}   Print("Error: ", GetLastError());\n${indent}}`;

            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, line.range, wrappedCode);

            await vscode.workspace.applyEdit(edit);
        })
    );

    // Quick Fix All command - uses independent analyzer (no compiler needed)
    context.subscriptions.push(
        vscode.commands.registerCommand('buraq_mql5_mql4.quickFixAll', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const document = editor.document;

            // Use independent analyzer - no compiler diagnostics needed
            const fixCount = await quickFixAnalyzer.applyAllFixes(document);

            if (fixCount > 0) {
                vscode.window.showInformationMessage(`Applied ${fixCount} quick fix${fixCount > 1 ? 'es' : ''}`);
            } else {
                vscode.window.showInformationMessage('No issues found in this file');
            }
        })
    );
}

module.exports = {
    createCodeActionProvider,
    registerCodeActionCommands
};
