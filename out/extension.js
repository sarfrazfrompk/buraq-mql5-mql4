'use strict';
const url = require('url');
const vscode = require('vscode');
const childProcess = require('child_process');
const fs = require('fs');
const pathModule = require('path');
const sleep = require('util').promisify(setTimeout);
const language = vscode.env.language;
const { compileFileCore } = require('./buraq-compiler/compilerCore');

// ANSI Color codes for Buraq Terminal
const ANSI_COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    BRIGHT_RED: '\x1b[1;31m',
    BRIGHT_GREEN: '\x1b[1;32m',
    BRIGHT_YELLOW: '\x1b[1;33m',
    BRIGHT_BLUE: '\x1b[1;34m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m',
    DIM: '\x1b[2m'
};

// Helper function to get visible text length (excluding ANSI codes)
function getVisibleLength(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

// Helper function to pad text to specific width while preserving ANSI codes
function padText(text, width, align = 'left') {
    const visibleLen = getVisibleLength(text);
    const padding = width - visibleLen;

    if (padding <= 0) return text;

    const spaces = ' '.repeat(padding);

    switch (align) {
        case 'right':
            return spaces + text;
        case 'center':
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
        default: // left
            return text + spaces;
    }
}

function colorizeText(text, color) {
    return `${color}${text}${ANSI_COLORS.RESET}`;
}

function colorizeError(text) {
    return colorizeText(text, ANSI_COLORS.BRIGHT_RED);
}

function colorizeSuccess(text) {
    return colorizeText(text, ANSI_COLORS.BRIGHT_GREEN);
}

function colorizeWarning(text) {
    return colorizeText(text, ANSI_COLORS.BRIGHT_YELLOW);
}

function colorizeInfo(text) {
    return colorizeText(text, ANSI_COLORS.BRIGHT_BLUE);
}

function colorizeDim(text) {
    return colorizeText(text, ANSI_COLORS.DIM);
}

// Helper to create a 24-bit color gradient (TrueColor) for terminal text
function createGradientText(text, startRGB, endRGB) {
    let result = '';
    const steps = text.length;
    for (let i = 0; i < steps; i++) {
        // Linear interpolation for R, G, B
        const r = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * (i / (steps - 1 || 1)));
        const g = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * (i / (steps - 1 || 1)));
        const b = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * (i / (steps - 1 || 1)));
        
        // \x1b[38;2;<r>;<g>;<b>m for foreground color
        result += `\x1b[38;2;${r};${g};${b}m${text[i]}`;
    }
    return result + ANSI_COLORS.RESET;
}

function writeModernHeader(extension, wn) {
    if (buraqTerminal && writeEmitter) {
        let label = 'Buraq MQL5';
        if (extension === '.mq4' || (extension === '.mqh' && wn)) {
            label = 'Buraq MQL4';
        }
        
        // --- 3D BIG FONT DEFINITION ---
        const BIG_FONT = {
            'B': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝'],
            'u': ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝'],
            'r': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║'],
            'a': [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║'],
            'q': [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝'],
            'M': ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║'],
            'Q': [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝'],
            'L': ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗'],
            '4': ['██╗  ██╗', '██║  ██║', '███████║', '╚═══██║ ', '    ██║ '],
            '5': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████╗'],
            ' ': ['    ', '    ', '    ', '    ', '    ']
        };

        const chars = label.split('');
        const rows = 5;
        let outputRows = ['', '', '', '', ''];
        
        // Assemble rows and calculate total width
        let totalWidth = 0;
        chars.forEach(char => {
            const pattern = BIG_FONT[char] || BIG_FONT[' '];
            pattern.forEach((line, i) => {
                outputRows[i] += line + '  ';
            });
            totalWidth += pattern[0].length + 2;
        });

        // 24-bit Gradient Colors
        const startRGB = [0, 162, 255]; // Blue
        const endRGB = [255, 69, 58];   // Red
        const shadowRGB = [60, 60, 60];  // Dark Gray for 3D depth

        // Render with horizontal gradient and shadow
        let renderedLines = [];
        
        // Add top padding
        writeEmitter.fire('\r\n');

        outputRows.forEach((row, rowIndex) => {
            let rowContent = '';
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const char = row[colIndex];
                if (char === ' ') {
                    rowContent += ' ';
                    continue;
                }

                // Calculate color for this column
                const ratio = colIndex / (row.length - 1 || 1);
                const r = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * ratio);
                const g = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * ratio);
                const b = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * ratio);
                
                // Colorize the character
                rowContent += `\x1b[38;2;${r};${g};${b}m${char}`;
            }
            
            // Add a simple 3D shadow offset to each row for depth
            const shadowLine = `\x1b[38;2;${shadowRGB[0]};${shadowRGB[1]};${shadowRGB[2]};2m`; // Dim shadow
            
            // Center the entire block (terminal is 80 units wide)
            const padding = Math.max(0, Math.floor((80 - row.length) / 2));
            const centeredLine = ' '.repeat(padding) + rowContent + ANSI_COLORS.RESET;
            writeEmitter.fire(centeredLine + '\r\n');
        });

        // Add bottom padding
        writeEmitter.fire('\r\n');
    }
}

// Status indicators for Buraq Terminal - Simplified for better alignment
const STATUS = {
    ERROR: '[ERROR]  ',
    WARNING: '[WARN]   ',
    SUCCESS: '[SUCCESS]',
    INFO: '[INFO]   ',
    STEP: '[STEP]   '
};

const { Help } = require("./help");
const { ShowFiles, InsertNameFileMQH, InsertMQH, InsertNameFileMQL, InsertMQL, InsertResource, InsertImport, InsertTime, InsertIcon, OpenFileInMetaEditor, CreateComment } = require("./contextMenu");
const { Hover_log, DefinitionProvider, Hover_MQL, ItemProvider, HelpProvider, ColorProvider } = require("./provider");
const { CreateProperties } = require("./createProperties");
const ChartView = require("./chartView");
const { createDefinitionProvider, createReferenceProvider, createDocumentSymbolProvider, createWorkspaceSymbolProvider, createRenameProvider, invalidateCache } = require("./symbolProvider");
const { createFoldingRangeProvider } = require("./foldingProvider");
const { createCodeLensProvider, clearReferenceCache } = require("./codeLensProvider");
const { createCodeActionProvider, registerCodeActionCommands } = require("./codeActionProvider");
const { createErrorCodeHoverProvider } = require("./errorCodeDatabase");
const { showDetectedPaths, autoConfigureIncludePaths } = require("./includePathDetector");
const { showCompiledFileInfo, compareCompiledFilesCommand } = require("./compiledFileDiff");
const { createDocumentLinkProvider } = require("./documentLinkProvider");
const { WorkspaceScanner, DiagnosticsManager, CompilationQueue } = require("./buraq-compiler");
const outputChannel = null; // Using Pseudoterminal instead
let buraqTerminal = null;
let writeEmitter = null;
let diagnosticsManager = null; // Single source of truth for diagnostics
let dashboardProvider = null; // Dashboard UI provider
let globalCompilationQueue = null; // Module-level queue instance

function initializeBuraqTerminal() {
    if (!buraqTerminal) {
        writeEmitter = new vscode.EventEmitter();
        const closeEmitter = new vscode.EventEmitter();

        const pty = {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open: () => { },
            close: () => {
                closeEmitter.fire();
                if (writeEmitter) {
                    try {
                        writeEmitter.dispose();
                    } catch (e) {
                        // Ignore disposal errors
                    }
                }
                buraqTerminal = null;
                writeEmitter = null;
            },
            handleInput: () => { }
        };

        buraqTerminal = vscode.window.createTerminal({ name: 'Buraq Terminal', pty });
    }

    try {
        buraqTerminal.show(true);
    } catch (e) {
        // Terminal is in invalid state, recreate it
        if (writeEmitter) {
            try {
                writeEmitter.dispose();
            } catch (e) {
                // Ignore disposal errors
            }
        }

        writeEmitter = new vscode.EventEmitter();
        const closeEmitter = new vscode.EventEmitter();

        const pty = {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open: () => { },
            close: () => {
                closeEmitter.fire();
                if (writeEmitter) {
                    try {
                        writeEmitter.dispose();
                    } catch (e) {
                        // Ignore disposal errors
                    }
                }
                buraqTerminal = null;
                writeEmitter = null;
            },
            handleInput: () => { }
        };

        buraqTerminal = vscode.window.createTerminal({ name: 'Buraq Terminal', pty });
        buraqTerminal.show(true);
    }
    return buraqTerminal;
}

try {
    var lg = require(`../landes.${language}.json`);
}
catch (error) {
    lg = require('../landes.json');
}

async function Compile(rt) {
    initializeBuraqTerminal();
    
    // Automatically show dashboard when compiling
    vscode.commands.executeCommand('buraq-mql-dashboard.focus');

    // CRITICAL: Clear terminal FIRST and wait for it to complete
    await clearTerminalCompletely();

    FixFormatting();
    vscode.commands.executeCommand('workbench.action.files.saveAll');
    
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;
    
    const filePath = activeEditor.document.fileName;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let logFileManager = null;
    if (workspaceRoot) {
        logFileManager = new (require('./buraq-compiler').LogFileManager)(workspaceRoot);
    }

    const logger = {
        initializeTerminal: initializeBuraqTerminal,
        clearTerminal: clearTerminalCompletely,
        writeModernHeader: writeModernHeader,
        writeSeparator: writeSeparator,
        writeFormattedLine: writeFormattedLine,
        writeToTerminal: writeToTerminal
    };

    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: `Buraq MQL5 & MQL4: ${rt === 0 ? lg['checking'] : lg['compiling']}`,
        },
        async () => {
            try {
                // Wait 150ms after clearing/formatting before starting compilation
                await sleep(150);
                
                await compileFileCore(
                    filePath,
                    rt,
                    {
                        logger,
                        parentFileSearch: true
                    },
                    diagnosticsManager,
                    logFileManager
                );
            } catch (error) {
                console.error('[Buraq MQL] Unified compile failed:', error);
            }
        }
    );
}

// Debounce timer for background checks
let backgroundCheckTimer = null;
// Log file manager instance for background checks
let backgroundLogManager = null;

// Run background syntax check on file save (silent, no terminal output)
function runBackgroundCheck(document) {
    console.log('[Buraq MQL] runBackgroundCheck called for:', document.fileName);
    
    // Debounce: clear previous timer and set new one
    if (backgroundCheckTimer) {
        clearTimeout(backgroundCheckTimer);
    }

    backgroundCheckTimer = setTimeout(async () => {
        const filePath = document.fileName;
        
        if (!backgroundLogManager) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
                backgroundLogManager = new (require('./buraq-compiler').LogFileManager)(workspaceRoot);
            }
        }

        try {
            await compileFileCore(
                filePath,
                0, // Syntax check
                {
                    silentWorkspace: true,
                    parentFileSearch: false
                },
                diagnosticsManager,
                backgroundLogManager
            );
            if (dashboardProvider) dashboardProvider.update();
        } catch (err) {
            console.error('[Buraq MQL] Background check error:', err);
        }
    }, 500);
}





function FindParentFile() {
    const { document } = vscode.window.activeTextEditor;
    const extension = pathModule.extname(document.fileName);
    if (extension === '.mqh') {
        const workspacepath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        let NameFileMQL, match, regEx = new RegExp('(\\/\\/###<).+(mq[4|5]>)', 'ig');

        while (match = regEx.exec(document.lineAt(0).text))
            NameFileMQL = match[0];

        if (NameFileMQL != undefined)
            NameFileMQL = pathModule.join(workspacepath, String(NameFileMQL.match(/(?<=<).+(?=>)/)));

        return NameFileMQL;
    } else {
        return undefined;
    }
}

function writeToTerminal(text) {
    if (buraqTerminal && writeEmitter) {
        try {
            writeEmitter.fire(text + '\r\n');
        } catch (e) {
            // If write fails, reinitialize and retry
            initializeBuraqTerminal();
            try {
                writeEmitter.fire(text + '\r\n');
            } catch (retryError) {
                // Ignore if retry fails
            }
        }
    }
}

function writeFormattedLine(status, message, detail = '') {
    if (buraqTerminal && writeEmitter) {
        try {
            let colorFunc;
            switch (status) {
                case STATUS.ERROR:
                    colorFunc = colorizeError;
                    break;
                case STATUS.WARNING:
                    colorFunc = colorizeWarning;
                    break;
                case STATUS.SUCCESS:
                    colorFunc = colorizeSuccess;
                    break;
                default:
                    colorFunc = colorizeInfo;
            }

            const line = colorFunc(padText(status, 12) + message + (detail ? ': ' + detail : ''));
            writeEmitter.fire(line + '\r\n');
        } catch (e) {
            // If write fails, reinitialize and retry
            initializeBuraqTerminal();
            try {
                const line = status + message + (detail ? ': ' + detail : '');
                writeEmitter.fire(line + '\r\n');
            } catch (retryError) {
                // Ignore if retry fails
            }
        }
    }
}

function writeSeparator() {
    if (buraqTerminal && writeEmitter) {
        try {
            const separator = colorizeDim('─'.repeat(80));
            writeEmitter.fire(separator + '\r\n');
        } catch (e) {
            // Ignore errors
        }
    }
}

async function clearTerminalCompletely() {
    if (buraqTerminal && writeEmitter) {
        try {
            // Small delay to ensure terminal is ready if it was just initialized
            await sleep(50);
            
            // Use the most comprehensive clear sequence
            // \x1b[3J - Clear scrollback buffer
            // \x1b[2J - Clear entire screen
            // \x1b[H - Move cursor to home (1,1)
            // \x1b[0m - Reset all attributes
            // \x1bc - Reset terminal (RIS)
            writeEmitter.fire('\x1b[3J\x1b[2J\x1b[H\x1b[0m\x1bc');
            
            // Wait a moment for reset to process
            await sleep(50);
        } catch (e) {
            // If clearing fails, try to recreate the terminal
            if (buraqTerminal) {
                try {
                    buraqTerminal.dispose();
                } catch (disposeError) {
                    // Ignore
                }
            }
            buraqTerminal = null;
            if (writeEmitter) {
                try {
                    writeEmitter.dispose();
                } catch (disposeError) {
                    // Ignore
                }
            }
            writeEmitter = null;

            // Reinitialize
            initializeBuraqTerminal();
            if (writeEmitter) {
                try {
                    await sleep(50);
                    writeEmitter.fire('\x1b[3J\x1b[2J\x1b[H\x1b[0m\x1bc');
                    await sleep(50);
                } catch (retryError) {
                    // Final fallback - just continue
                }
            }
        }
    }
}

function tf(date, t, d) {
    switch (t) {
        case 'Y': d = date.getFullYear(); break;
        case 'M': d = date.getMonth() + 1; break;
        case 'D': d = date.getDate(); break;
        case 'h': d = date.getHours(); break;
        case 'm': d = date.getMinutes(); break;
        case 's': d = date.getSeconds(); break;
    }

    return d < 10 ? '0' + d.toString() : d.toString();
}

function FixFormatting() {
    const { document, edit } = vscode.window.activeTextEditor, array = [],
        data = {
            reg: [
                "\\bC '\\d{1,3},\\d{1,3},\\d{1,3}'",
                "\\bC '0x[A-Fa-f0-9]{2},0x[A-Fa-f0-9]{2},0x[A-Fa-f0-9]{2}'",
                "\\bD '(?:(?:\\d{2}|\\d{4})\\.\\d{2}\\.(?:\\d{2}|\\d{4})|(?:\\d{2}|\\d{4})\\.\\d{2}\\.(?:\\d{2}|\\d{4})\\s{1,}[\\d:]+)'"
            ],
            searchValue: [
                "C ",
                "C ",
                "D "
            ],
            replaceValue: [
                "C",
                "C",
                "D"
            ]
        };

    Array.from(document.getText().matchAll(new RegExp(CollectRegEx(data.reg), 'g'))).map(match => {
        for (const i in data.reg) {
            if (match[0].match(new RegExp(data.reg[i], 'g'))) {
                let range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length))
                array.push({ range, to: document.getText(range).replace(data.searchValue[i], data.replaceValue[i]) })
            }
        }
    });

    array.length && edit(edit => array.forEach(({ range, to }) => edit.replace(range, to)));
}

function CollectRegEx(dt, string = "") {
    for (const i in dt) {
        string += dt[i] + '|';
    }
    return string.slice(0, -1);
}

function showChangelog(context) {
    const pkg = require('../package.json');
    const currentVersion = pkg.version;
    const lastVersion = context.globalState.get('buraq_mql5_mql4_version');

    if (currentVersion !== lastVersion) {
        context.globalState.update('buraq_mql5_mql4_version', currentVersion);

        try {
            const changelogPath = pathModule.join(__dirname, '../CHANGELOG.md');
            if (fs.existsSync(changelogPath)) {
                const uri = vscode.Uri.file(changelogPath);
                vscode.commands.executeCommand('markdown.showPreview', uri);
            }
        } catch (e) {
            console.error('Failed to show changelog:', e);
        }
    }
}

/**
 * Register file template commands
 */
function registerTemplateCommands(context) {
    const templateTypes = [
        { command: 'newExpertAdvisor', label: 'Expert Advisor', ext4: '.mq4', ext5: '.mq5', template4: 'expert_advisor.mq4', template5: 'expert_advisor.mq5' },
        { command: 'newIndicator', label: 'Indicator', ext4: '.mq4', ext5: '.mq5', template4: 'indicator.mq4', template5: 'indicator.mq5' },
        { command: 'newScript', label: 'Script', ext4: '.mq4', ext5: '.mq5', template4: 'script.mq4', template5: 'script.mq5' },
        { command: 'newLibrary', label: 'Library', ext4: '.mqh', ext5: '.mqh', template4: 'library.mqh', template5: 'library.mqh' }
    ];

    for (const type of templateTypes) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`buraq_mql5_mql4.${type.command}`, async () => {
                // Ask for MQL version
                const version = await vscode.window.showQuickPick(['MQL5', 'MQL4'], {
                    placeHolder: 'Select MQL version'
                });

                if (!version) return;

                // Ask for file name
                const fileName = await vscode.window.showInputBox({
                    prompt: `Enter ${type.label} name`,
                    placeHolder: `My${type.label.replace(/\s/g, '')}`,
                    validateInput: (value) => {
                        if (!value || !value.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                            return 'Invalid file name. Use letters, numbers, and underscores.';
                        }
                        return null;
                    }
                });

                if (!fileName) return;

                // Determine template and extension
                const isMQL5 = version === 'MQL5';
                const ext = isMQL5 ? type.ext5 : type.ext4;
                const templateFile = isMQL5 ? type.template5 : type.template4;

                // Read template
                const templatePath = pathModule.join(__dirname, '../templates', templateFile);
                let templateContent = '';

                try {
                    templateContent = fs.readFileSync(templatePath, 'utf8');
                } catch (e) {
                    vscode.window.showErrorMessage(`Template file not found: ${templatePath}`);
                    return;
                }

                // Replace placeholders
                const year = new Date().getFullYear();
                const author = vscode.workspace.getConfiguration('buraq_mql5_mql4').get('author', 'sarfrazfrompk');
                const link = vscode.workspace.getConfiguration('buraq_mql5_mql4').get('link', 'https://sarfrazfrompk.com');

                templateContent = templateContent
                    .replace(/\$\{FILE_NAME\}/g, fileName + ext)
                    .replace(/\$\{YEAR\}/g, year.toString())
                    .replace(/\$\{AUTHOR\}/g, author)
                    .replace(/\$\{LINK\}/g, link);

                // Determine save location
                let targetFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

                if (!targetFolder) {
                    const selected = await vscode.window.showOpenDialog({
                        canSelectFolders: true,
                        canSelectFiles: false,
                        canSelectMany: false,
                        openLabel: 'Select folder'
                    });

                    if (selected && selected[0]) {
                        targetFolder = selected[0].fsPath;
                    } else {
                        return;
                    }
                }

                // Create the file
                const targetPath = pathModule.join(targetFolder, fileName + ext);

                if (fs.existsSync(targetPath)) {
                    const overwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
                        placeHolder: `File ${fileName}${ext} already exists. Overwrite?`
                    });

                    if (overwrite !== 'Yes') return;
                }

                try {
                    fs.writeFileSync(targetPath, templateContent, 'utf8');

                    // Open the file
                    const doc = await vscode.workspace.openTextDocument(targetPath);
                    await vscode.window.showTextDocument(doc);

                    vscode.window.showInformationMessage(`Created ${type.label}: ${fileName}${ext}`);
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to create file: ${e.message}`);
                }
            })
        );
    }
}

function activate(context) {
    CreateProperties();
    initializeBuraqTerminal();
    showChangelog(context);

    // Initialize new Buraq Compiler modules
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    // CRITICAL: Initialize DiagnosticsManager first
    diagnosticsManager = new DiagnosticsManager();
    diagnosticsManager.initialize(context);
    console.log('[Buraq MQL] DiagnosticsManager initialized');

    // Initialize Dashboard Provider
    dashboardProvider = new (require('./MQLDashboardProvider'))(context.extensionUri, diagnosticsManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('buraq-mql-dashboard', dashboardProvider, {
            webviewOptions: {
                retainContextWhenHidden: true
            }
        })
    );

    if (workspaceRoot) {
        // Initialize global CompilationQueue for sequential compilation
        globalCompilationQueue = new CompilationQueue(workspaceRoot, diagnosticsManager);

        // REAL-TIME DASHBOARD UPDATES: Listen to queue events
        globalCompilationQueue.on('compiling', (file) => {
            if (dashboardProvider) {
                dashboardProvider.setCompiling(file);
            }
        });
        globalCompilationQueue.on('finished', () => {
            if (dashboardProvider) {
                dashboardProvider.setCompiling(null);
                dashboardProvider.update();
            }
        });

        // Initialize WorkspaceScanner for auto-compilation on activation
        const workspaceScanner = new WorkspaceScanner(workspaceRoot);

        // Store in context for access by other parts of the extension
        context.globalState.update('buraqCompilerInitialized', true);
        context.workspaceState.update('workspaceScanner', workspaceScanner);

        // Register Dashboard-specific commands
        context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compileAllWorkspace', async () => {
            if (globalCompilationQueue && workspaceRoot) {
                const scanner = new WorkspaceScanner(workspaceRoot);
                vscode.window.showInformationMessage('Compiling all MQL files in workspace...');
                const files = await scanner.scan();
                // Focus dashboard once when manual compilation starts
                vscode.commands.executeCommand('buraq-mql-dashboard.focus');
                await globalCompilationQueue.enqueueAll(files, { checkOnly: false });
                if (dashboardProvider) dashboardProvider.update();
            }
        }));

        context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compileMainFile', async () => {
            if (globalCompilationQueue && workspaceRoot) {
                // Search for the first .mq5 file in the root
                const files = await vscode.workspace.findFiles('*.mq5', null, 1);
                if (files.length > 0) {
                    vscode.window.showInformationMessage(`Compiling main file: ${pathModule.basename(files[0].fsPath)}`);
                    // Focus dashboard once when manual compilation starts
                    vscode.commands.executeCommand('buraq-mql-dashboard.focus');
                    await globalCompilationQueue.enqueue(files[0].fsPath, { checkOnly: false });
                    if (dashboardProvider) dashboardProvider.update();
                } else {
                    vscode.window.showErrorMessage('No .mq5 file found in the root of the workspace.');
                    if (dashboardProvider) dashboardProvider.setCompiling(null);
                }
            }
        }));

        // Auto-compile all MQL files on activation (sequential, respecting .buraqignore)
        compileAllFilesOnActivation(workspaceScanner, globalCompilationQueue, dashboardProvider);
    }

    const chartView = new ChartView(context);

    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.checkFile', () => Compile(0)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compileFile', () => Compile(1)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compileScript', () => Compile(2)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.help', () => Help(true)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.configurations', () => CreateProperties()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.Showfiles', () => ShowFiles('**/*.ex4', '**/*.ex5')));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsMQL', () => InsertMQL()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsMQH', () => InsertMQH()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsNameMQL', (uri) => InsertNameFileMQL(uri)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsNameMQH', (uri) => InsertNameFileMQH(uri)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsResource', () => InsertResource()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsImport', () => InsertImport()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsTime', () => InsertTime()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.InsIcon', () => InsertIcon()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.openInME', (uri) => OpenFileInMetaEditor(uri)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.commentary', () => CreateComment()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.showChartView', () => chartView.show()));
    const mqlLanguages = ['mql4', 'mql5', 'mqlh'];
    context.subscriptions.push(vscode.languages.registerHoverProvider('mql-output', Hover_log()));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('mql-output', DefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerHoverProvider(mqlLanguages, Hover_MQL()));
    context.subscriptions.push(vscode.languages.registerColorProvider(mqlLanguages, ColorProvider()));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(mqlLanguages, ItemProvider()));
    sleep(1000).then(() => { context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(mqlLanguages, HelpProvider(), '(', ',')); });

    // Register new symbol providers (Phase 1 features)
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(mqlLanguages, createDefinitionProvider()));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(mqlLanguages, createReferenceProvider()));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(mqlLanguages, createDocumentSymbolProvider()));
    context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(createWorkspaceSymbolProvider()));
    context.subscriptions.push(vscode.languages.registerRenameProvider(mqlLanguages, createRenameProvider()));
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(mqlLanguages, createFoldingRangeProvider()));
    // Register Document Link Provider for #include navigation
    context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(mqlLanguages, createDocumentLinkProvider()));

    // Invalidate symbol cache when documents change
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        invalidateCache(event.document);
        clearReferenceCache(); // Also clear code lens cache
    }));

    // Register Phase 2 providers (Code Quality & Productivity)
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(mqlLanguages, createCodeLensProvider()));
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider(mqlLanguages, createCodeActionProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.Refactor, vscode.CodeActionKind.Source]
    }));

    // Register code action commands
    registerCodeActionCommands(context);

    // Register file template commands
    registerTemplateCommands(context);

    // Register error code hover provider (shows descriptions for ERR_* codes)
    context.subscriptions.push(vscode.languages.registerHoverProvider(mqlLanguages, createErrorCodeHoverProvider()));

    // Register include path detection commands
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.detectIncludePaths', showDetectedPaths));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.autoConfigureIncludePaths', autoConfigureIncludePaths));

    // Register compiled file commands
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.showCompiledFileInfo', showCompiledFileInfo));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compareCompiledFiles', compareCompiledFilesCommand));

    // Auto-configure include paths on first activation (if not already set)
    autoConfigureIncludePaths();

    // Auto-check on file save - register handler for automatic diagnostics
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
        const ext = pathModule.extname(doc.fileName).toLowerCase();
        if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
            runBackgroundCheck(doc);
        }
    }));

    // Auto-check on file change - re-check syntax when file content changes
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const doc = event.document;
        const ext = pathModule.extname(doc.fileName).toLowerCase();
        if (['.mq4', '.mq5', '.mqh'].includes(ext) && event.contentChanges.length > 0) {
            runBackgroundCheck(doc);
        }
    }));

    // Auto-check on file open
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        const ext = pathModule.extname(doc.fileName).toLowerCase();
        if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
            runBackgroundCheck(doc);
        }
    }));

    // Auto-check when switching to a different editor
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document) {
            const ext = pathModule.extname(editor.document.fileName).toLowerCase();
            if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
                runBackgroundCheck(editor.document);
            }
        }
    }));

    // Auto-check when visible editors change
    context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
            const ext = pathModule.extname(editor.document.fileName).toLowerCase();
            if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
                runBackgroundCheck(editor.document);
            }
        }
    }));

    // Clear diagnostics when file is closed
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(doc => {
        const ext = pathModule.extname(doc.fileName).toLowerCase();
        if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
            // Clear diagnostics for this file when closed
            if (diagnosticsManager) {
                diagnosticsManager.clearDiagnostics(doc.fileName);
                console.log('[Buraq MQL] Cleared diagnostics for closed file:', doc.fileName);
            }
        }
    }));

    // Scan all open MQL files on activation
    scanOpenMQLFiles();
}

/**
 * Compile all MQL files on extension activation
 * Scans workspace, respects .buraqignore, compiles sequentially
 */
async function compileAllFilesOnActivation(scanner, queue, dashboard) {
    console.log('[Buraq MQL] Starting auto-compilation on activation...');
    
    try {
        // Small delay to ensure VS Code is fully ready
        await sleep(1000);
        
        // Scan workspace for all MQL files
        const files = await scanner.scan();
        
        if (files.length === 0) {
            console.log('[Buraq MQL] No MQL files found to compile');
            return;
        }
        
        console.log('[Buraq MQL] Found', files.length, 'files to compile');
        
        // Automatically show dashboard when auto-compilation starts on activation
        vscode.commands.executeCommand('buraq-mql-dashboard.focus');
        
        // Enqueue all files for sequential compilation
        // The queue handles sequential processing automatically
        await queue.enqueueAll(files, { checkOnly: true });
        
        const status = queue.getStatus();
        console.log('[Buraq MQL] Auto-compilation complete. Results:', status.resultsCount, 'files processed');
        
        // Update dashboard after auto-compilation
        if (dashboard) dashboard.update();
        
    } catch (error) {
        console.error('[Buraq MQL] Error during auto-compilation:', error.message);
    }
}

// Scan all currently open MQL files and run background check
async function scanOpenMQLFiles() {
    // Small delay to ensure extension is fully activated
    await sleep(500);

    // Check all visible editors
    for (const editor of vscode.window.visibleTextEditors) {
        const ext = pathModule.extname(editor.document.fileName).toLowerCase();
        if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
            runBackgroundCheck(editor.document);
        }
    }

    // Also check open documents that might not be visible
    for (const doc of vscode.workspace.textDocuments) {
        const ext = pathModule.extname(doc.fileName).toLowerCase();
        if (['.mq4', '.mq5', '.mqh'].includes(ext)) {
            runBackgroundCheck(doc);
        }
    }
}

/**
 * Compile a single file using the new queue system (optional - for manual compilation)
 */
async function compileFileWithQueue(filePath, options = {}) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    
    const diagnosticsManager = new DiagnosticsManager();
    const queue = new CompilationQueue(workspaceRoot, diagnosticsManager);
    
    try {
        const result = await queue.enqueue(filePath, options);
        return result;
    } catch (error) {
        vscode.window.showErrorMessage(`Compilation failed: ${error.message}`);
        throw error;
    }
}

function deactivate() {
    if (buraqTerminal) {
        try {
            buraqTerminal.dispose();
        } catch (e) {
            // Ignore disposal errors
        }
        buraqTerminal = null;
    }
    if (writeEmitter) {
        try {
            writeEmitter.dispose();
        } catch (e) {
            // Ignore disposal errors
        }
        writeEmitter = null;
    }
}

try {
    var lg = require(`../landes.${language}.json`);
}
catch (error) {
    lg = require('../landes.json');
}
exports.lg = lg;
exports.tf = tf;
exports.compileFileWithQueue = compileFileWithQueue;
module.exports = {
    activate,
    deactivate,
    compileFileWithQueue
}
