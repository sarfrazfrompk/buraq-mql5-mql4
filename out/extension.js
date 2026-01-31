'use strict';
const url = require('url');
const vscode = require('vscode');
const childProcess = require('child_process');
const fs = require('fs');
const pathModule = require('path');
const sleep = require('util').promisify(setTimeout);
const language = vscode.env.language;

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
const { IconsInstallation } = require("./addIcon");
const { Hover_log, DefinitionProvider, Hover_MQL, ItemProvider, HelpProvider, ColorProvider } = require("./provider");
const { CreateProperties } = require("./createProperties");
const ChartView = require("./chartView");
const { createDefinitionProvider, createReferenceProvider, createDocumentSymbolProvider, createWorkspaceSymbolProvider, createRenameProvider, invalidateCache } = require("./symbolProvider");
const { createFoldingRangeProvider } = require("./foldingProvider");
const { createCodeLensProvider, clearReferenceCache } = require("./codeLensProvider");
const { createCodeActionProvider, registerCodeActionCommands } = require("./codeActionProvider");
const outputChannel = null; // Using Pseudoterminal instead
let buraqTerminal = null;
let writeEmitter = null;
let diagnosticCollection = null; // For Problems panel integration

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

function Compile(rt) {
    initializeBuraqTerminal();

    // CRITICAL: Clear terminal FIRST and wait for it to complete
    clearTerminalCompletely();

    FixFormatting();
    vscode.commands.executeCommand('workbench.action.files.saveAll');
    const NameFileMQL = rt != 0 ? FindParentFile() : '',
        path = NameFileMQL != undefined ? (fs.existsSync(NameFileMQL) ? NameFileMQL : vscode.window.activeTextEditor.document.fileName) : vscode.window.activeTextEditor.document.fileName,
        config = vscode.workspace.getConfiguration('buraq_mql5_mql4'),
        fileName = pathModule.basename(path),
        extension = pathModule.extname(path),
        PathScript = pathModule.join(__dirname, '../', 'mql-files', 'BuraqCompiler.exe'),
        logDir = config.LogFile.NameLog, Timemini = config.Script.Timetomini,
        mme = config.Script.MiniME, cme = config.Script.CloseME,
        wn = vscode.workspace.name.includes('MQL4'), startT = new Date(),
        time = `${tf(startT, 'h')}:${tf(startT, 'm')}:${tf(startT, 's')}`;

    let logFile, command, MetaDir, incDir, CommM, CommI, teq, includefile, log;

    if (extension === '.mq4' || extension === '.mqh' && wn && rt === 0) {
        MetaDir = resolveMetaEditorPath(4, config.Metaeditor.Metaeditor4Dir);
        incDir = config.Metaeditor.Include4Dir;
        CommM = lg['path_editor4'];
        CommI = lg['path_include_4'];
    } else if (extension === '.mq5' || extension === '.mqh' && !wn && rt === 0) {
        MetaDir = resolveMetaEditorPath(5, config.Metaeditor.Metaeditor5Dir);
        incDir = config.Metaeditor.Include5Dir;
        CommM = lg['path_editor5'];
        CommI = lg['path_include_5'];
    } else if (extension === '.mqh' && rt !== 0) {
        return vscode.window.showWarningMessage(lg['mqh']);
    } else {
        return undefined;
    }

    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: `Buraq MQL5 & MQL4: ${rt === 0 ? lg['checking'] : lg['compiling']}`,
        },
        () => {
            return new Promise((resolve) => {

                switch (rt) {
                    case 0: teq = lg['checking'];
                        break;
                    case 1: teq = lg['compiling'];
                        break;
                    case 2: teq = lg['comp_usi_script'];
                        break;
                }

                // Wait a moment after clearing before writing new content
                setTimeout(() => {
                    // Write header after clearing has completed
                    writeSeparator();
                    writeFormattedLine(STATUS.INFO, `Starting ${teq}`, `[${time}]`);
                    writeFormattedLine(STATUS.STEP, `Target file`, fileName);
                    writeSeparator();

                    const Nm = pathModule.basename(MetaDir), Pm = pathModule.dirname(MetaDir);

                    if (!(MetaDir && fs.existsSync(MetaDir))) {
                        writeFormattedLine(STATUS.ERROR, CommM, '');
                        writeFormattedLine(STATUS.ERROR, `Path not found`, MetaDir);
                        writeSeparator();
                        return resolve();
                    }

                    if (incDir.length) {
                        if (!fs.existsSync(incDir)) {
                            writeFormattedLine(STATUS.ERROR, CommI, '');
                            writeFormattedLine(STATUS.ERROR, `Path not found`, incDir);
                            writeSeparator();
                            return resolve();
                        } else {
                            includefile = ` /include:"${incDir}"`;
                        }
                    } else {
                        includefile = '';
                    }

                    if (logDir.length) {
                        if (pathModule.extname(logDir) === '.log') {
                            logFile = path.replace(fileName, logDir);
                        } else {
                            logFile = path.replace(fileName, logDir + '.log');
                        }
                    } else {
                        logFile = path.replace(fileName, fileName.match(/.+(?=\.)/) + '.log');
                    }

                    command = `"${MetaDir}" /compile:"${path}"${includefile}${rt === 1 || (rt === 2 && cme) ? '' : ' /s'} /log:"${logFile}"`;

                    childProcess.exec(command, (err, stdout, stderror) => {

                        if (stderror) {
                            writeFormattedLine(STATUS.ERROR, lg['editor64'], CommM);
                            writeFormattedLine(STATUS.ERROR, `Current path`, MetaDir);
                            writeFormattedLine(STATUS.WARNING, lg['editor64to'], '');
                            writeFormattedLine(STATUS.INFO, `Suggested path`, `${Pm}\\${(Nm === 'metaeditor.exe' ? 'metaeditor64.exe' : 'metaeditor.exe')}`);
                            writeSeparator();
                            return resolve();
                        }

                        try {
                            var data = fs.readFileSync(logFile, 'utf16le');
                        } catch (err) {
                            writeFormattedLine(STATUS.ERROR, lg['err_read_log'], String(err));
                            writeSeparator();
                            return vscode.window.showErrorMessage(`${lg['err_read_log']} ${err}`), resolve();
                        }

                        config.LogFile.DeleteLog && fs.unlink(logFile, (err) => {
                            err && vscode.window.showErrorMessage(lg['err_remove_log']);
                        });

                        switch (rt) {
                            case 0: log = replaceLog(data, false); applyDiagnostics(log.diagnostics); writeToTerminal(log.text); writeSeparator(); resolve(); break;
                            case 1: log = replaceLog(data, true); applyDiagnostics(log.diagnostics); writeToTerminal(log.text); writeSeparator(); resolve(); break;
                            case 2: log = cme ? replaceLog(data, true) : replaceLog(data, false); applyDiagnostics(log.diagnostics); break;
                        }

                        const end = new Date;

                        if (rt === 2 && !log.error) {
                            let TimeClose = (Math.ceil((end - startT) * 0.01) * 100);
                            command = `"${PathScript}" "${MetaDir}" "${path}" ${mme ? 1 : 0} ${Timemini} ${cme ? 1 : 0} ${TimeClose} ${Nm}`;

                            try {
                                childProcess.exec(command);
                            }
                            catch (error) {
                                writeFormattedLine(STATUS.ERROR, lg['err_start_script'], '');
                                writeSeparator();
                                return resolve();
                            }
                            writeToTerminal(cme ? log.text : log.text + '\n' + colorizeInfo(padText(STATUS.INFO, 12) + lg['info_log_compile']));
                            writeSeparator();
                            resolve();
                        } else if (rt === 2 && log.error) {
                            writeToTerminal(log.text);
                            writeSeparator();
                            resolve();
                        }
                    });
                    sleep(30000).then(() => { resolve(); });
                }, 50); // Wait 50ms after clearing before writing new content
            });
        }
    );
}

// Helper function to apply diagnostics to Problems panel
function applyDiagnostics(diagnosticsMap) {
    console.log('[Buraq MQL] applyDiagnostics called, diagnosticCollection exists:', !!diagnosticCollection);
    if (diagnosticCollection) {
        diagnosticCollection.clear();
        if (diagnosticsMap && diagnosticsMap.size > 0) {
            console.log('[Buraq MQL] Found', diagnosticsMap.size, 'files with diagnostics');
            diagnosticsMap.forEach((diagnostics, filePath) => {
                console.log('[Buraq MQL] Setting', diagnostics.length, 'diagnostics for:', filePath);
                const uri = vscode.Uri.file(filePath);
                diagnosticCollection.set(uri, diagnostics);
            });
        } else {
            console.log('[Buraq MQL] No diagnostics to apply');
        }
    } else {
        console.log('[Buraq MQL] ERROR: diagnosticCollection is null!');
    }
}

// Debounce timer for background checks
let backgroundCheckTimer = null;

// Run background syntax check on file save (silent, no terminal output)
function runBackgroundCheck(document) {
    console.log('[Buraq MQL] runBackgroundCheck called for:', document.fileName);
    // Debounce: clear previous timer and set new one
    if (backgroundCheckTimer) {
        clearTimeout(backgroundCheckTimer);
    }

    backgroundCheckTimer = setTimeout(() => {
        const filePath = document.fileName;
        const extension = pathModule.extname(filePath).toLowerCase();
        const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
        const wn = vscode.workspace.name ? vscode.workspace.name.includes('MQL4') : false;

        console.log('[Buraq MQL] File extension:', extension);

        let MetaDir;
        if (extension === '.mq4' || (extension === '.mqh' && wn)) {
            MetaDir = resolveMetaEditorPath(4, config.Metaeditor.Metaeditor4Dir);
        } else if (extension === '.mq5' || (extension === '.mqh' && !wn)) {
            MetaDir = resolveMetaEditorPath(5, config.Metaeditor.Metaeditor5Dir);
        } else {
            console.log('[Buraq MQL] Not an MQL file, skipping');
            return;
        }

        console.log('[Buraq MQL] MetaEditor path:', MetaDir);

        if (!MetaDir || !fs.existsSync(MetaDir)) {
            console.log('[Buraq MQL] MetaEditor not found at:', MetaDir);
            return;
        }

        const logDir = config.LogFile && config.LogFile.NameLog ? config.LogFile.NameLog : pathModule.dirname(filePath);
        const fileName = pathModule.basename(filePath);
        const logFile = pathModule.join(logDir, fileName.replace(/\.(mq4|mq5|mqh)$/i, '.log'));

        // Build MetaEditor command for syntax check (silent mode)
        const command = `"${MetaDir}" /s /compile:"${filePath}" /log:"${logFile}"`;
        console.log('[Buraq MQL] Running command:', command);

        childProcess.exec(command, { windowsHide: true }, (error, stdout, stderr) => {
            console.log('[Buraq MQL] Compilation finished, error:', error ? error.message : 'none');
            // Read log file after compilation
            setTimeout(() => {
                console.log('[Buraq MQL] Checking for log file:', logFile);
                if (fs.existsSync(logFile)) {
                    console.log('[Buraq MQL] Log file exists, reading...');
                    fs.readFile(logFile, 'utf16le', (err, data) => {
                        if (!err && data) {
                            console.log('[Buraq MQL] Log data length:', data.length);
                            const log = replaceLog(data, false);
                            console.log('[Buraq MQL] Diagnostics count:', log.diagnostics ? log.diagnostics.size : 0);
                            applyDiagnostics(log.diagnostics);
                        } else {
                            console.log('[Buraq MQL] Error reading log file:', err);
                        }
                        // Optionally delete log file
                        if (config.LogFile && config.LogFile.DeleteLog) {
                            fs.unlink(logFile, () => { });
                        }
                    });
                } else {
                    console.log('[Buraq MQL] Log file not found');
                }
            }, 500); // Wait for log file to be written
        });
    }, 300); // 300ms debounce delay
}


function replaceLog(str, isFullCompile) {
    let outputLines = [];
    let obj_hover = {};
    let hasErrors = false;
    let errorCount = 0;
    let warningCount = 0;
    let diagnosticsMap = new Map(); // Map<filePath, Diagnostic[]>

    const lines = str.replace(/\u{FEFF}/gu, '').split('\n');

    lines.forEach(item => {
        const trimmed = item.trim();
        if (!trimmed) return;

        // Debug: Log ALL lines to understand log format
        console.log('[Buraq MQL] LOG LINE:', trimmed.substring(0, 150));

        // Handle compilation/checking info
        if (trimmed.includes(': information: compiling') || trimmed.includes(': information: checking')) {
            const action = isFullCompile ? 'compiling' : 'checking';
            const mm = item.match(new RegExp(`(?<=${action}.).+'`, 'gi'));
            const pm = item.match(/[a-z]:\\.+(?= :)/gi);

            if (mm && pm) {
                const name = mm[0].replace(/'/g, '');
                const link = url.pathToFileURL(pm[0]).href;
                Object.assign(obj_hover, { [name]: { ['link']: link } });
                outputLines.push(colorizeInfo(padText(STATUS.STEP, 12) + name));
            }
        }
        // Handle include files
        else if (trimmed.includes(': information: including')) {
            const mm = item.match(/(?<=information: including ).+'/gi);
            const pm = item.match(/[a-z]:\\.+(?= :)/gi);

            if (mm && pm) {
                const name_icl = mm[0].replace(/'/g, '');
                const link_icl = url.pathToFileURL(pm[0]).href;
                Object.assign(obj_hover, { [name_icl]: { ['link']: link_icl } });
                outputLines.push(colorizeDim(padText('  └─ Include', 12) + name_icl));
            }
        }
        // Skip code generation messages
        else if (trimmed.includes('information: generating code') || trimmed.includes('information: code generated')) {
            return;
        }
        // Handle info messages
        else if (trimmed.includes('information: info')) {
            const mm = item.match(/(?<=information: ).+/gi);
            const pm = item.match(/[a-z]:\\.+(?= :)/gi);

            if (mm) {
                const name_info = mm[0];
                const link_info = pm ? url.pathToFileURL(pm[0]).href : '';
                Object.assign(obj_hover, { [name_info]: { ['link']: link_info } });
                outputLines.push(colorizeInfo(padText(STATUS.INFO, 12) + name_info));
            }
        }
        // Handle result summary
        else if (trimmed.includes('Result:') || trimmed.includes(': information: result')) {
            const ecMatch = item.match(/(\d+)\s+error/i);
            const wcMatch = item.match(/(\d+)\s+warning/i);

            errorCount = ecMatch ? parseInt(ecMatch[1]) : 0;
            warningCount = wcMatch ? parseInt(wcMatch[1]) : 0;

            outputLines.push(''); // Empty line before result

            if (errorCount > 0) {
                hasErrors = true;
                outputLines.push(colorizeError(padText(STATUS.ERROR, 12) + `Compilation failed: ${errorCount} error(s), ${warningCount} warning(s)`));
            } else if (warningCount > 0) {
                outputLines.push(colorizeWarning(padText(STATUS.WARNING, 12) + `Compilation completed with ${warningCount} warning(s)`));
            } else {
                outputLines.push(colorizeSuccess(padText(STATUS.SUCCESS, 12) + 'Compilation successful - no errors or warnings'));
            }
        }
        // Handle errors and warnings
        // MetaEditor format: FilePath(line,col) : error NNN: message
        else {
            // Regex to match: D:\path\file.mq5(7,1) : error 149: message
            const errorRegex = /^(.+)\((\d+),(\d+)\)\s*:\s*(error|warning)\s+(\d+):\s*(.+)$/i;
            const match = trimmed.match(errorRegex);

            if (match) {
                const filePath = match[1].trim();
                const lineNum = parseInt(match[2]);
                const colNum = parseInt(match[3]);
                const errType = match[4].toLowerCase(); // 'error' or 'warning'
                const errCode = match[5];
                const errMessage = match[6].trim();

                const isError = errType === 'error';
                const posStr = `(${lineNum},${colNum})`;
                const fullMessage = `${errType} ${errCode}: ${errMessage}`;

                console.log('[Buraq MQL] Matched error:', filePath, 'line:', lineNum, 'col:', colNum, 'msg:', errMessage);

                // Add to hover info
                const key = fullMessage + ' ' + posStr;
                const href = url.pathToFileURL(filePath).href + '#' + lineNum + ',' + colNum;
                Object.assign(obj_hover, { [key]: { ['link']: href, ['number']: errCode } });

                // Add to terminal output
                const statusIndicator = isError ? STATUS.ERROR : STATUS.WARNING;
                const colorFunc = isError ? colorizeError : colorizeWarning;
                outputLines.push(colorFunc(padText(statusIndicator, 12) + fullMessage + ' ' + posStr));

                // Build diagnostic for Problems panel
                if (filePath && fs.existsSync(filePath)) {
                    const line = Math.max(0, lineNum - 1);
                    const col = Math.max(0, colNum - 1);
                    const range = new vscode.Range(line, col, line, col + 100); // Extend range to highlight more
                    const severity = isError ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                    const diagnostic = new vscode.Diagnostic(range, errMessage, severity);
                    diagnostic.source = 'Buraq Compiler';
                    diagnostic.code = errCode;

                    if (!diagnosticsMap.has(filePath)) {
                        diagnosticsMap.set(filePath, []);
                    }
                    diagnosticsMap.get(filePath).push(diagnostic);
                    console.log('[Buraq MQL] Added diagnostic:', errMessage, 'at line', line, 'col', col);
                } else {
                    console.log('[Buraq MQL] File not found:', filePath);
                }
            } else {
                // Fallback for other message formats
                const name_res = trimmed;
                if (name_res && !name_res.includes(': information:')) {
                    const isError = name_res.toLowerCase().includes('error');
                    const statusIndicator = isError ? STATUS.ERROR : STATUS.INFO;
                    const colorFunc = isError ? colorizeError : colorizeInfo;
                    outputLines.push(colorFunc(padText(statusIndicator, 12) + name_res));
                }
            }
        }
    });

    exports.obj_hover = obj_hover;
    return {
        text: outputLines.join('\r\n'),
        error: hasErrors,
        diagnostics: diagnosticsMap
    };
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

function clearTerminalCompletely() {
    if (buraqTerminal && writeEmitter) {
        try {
            // Use the most comprehensive clear sequence
            // \x1b[3J - Clear scrollback buffer
            // \x1b[2J - Clear entire screen
            // \x1b[H - Move cursor to home (1,1)
            // \x1b[0m - Reset all attributes
            writeEmitter.fire('\x1b[3J\x1b[2J\x1b[H\x1b[0m');
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
                    writeEmitter.fire('\x1b[3J\x1b[2J\x1b[H\x1b[0m');
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
                const author = vscode.workspace.getConfiguration('buraq_mql5_mql4').get('author', 'Your Name');
                const link = vscode.workspace.getConfiguration('buraq_mql5_mql4').get('link', 'https://www.example.com');

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

    // Initialize diagnostic collection for Problems panel
    diagnosticCollection = vscode.languages.createDiagnosticCollection('mql');
    context.subscriptions.push(diagnosticCollection);

    const chartView = new ChartView(context);

    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.checkFile', () => Compile(0)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compileFile', () => Compile(1)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.compileScript', () => Compile(2)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.help', () => Help(true)));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.configurations', () => CreateProperties()));
    context.subscriptions.push(vscode.commands.registerCommand('buraq_mql5_mql4.Addicon', () => IconsInstallation()));
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
            if (diagnosticCollection) {
                diagnosticCollection.delete(doc.uri);
            }
        }
    }));

    // Scan all open MQL files on activation
    scanOpenMQLFiles();
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
module.exports = {
    activate,
    deactivate
}

function resolveMetaEditorPath(v, p) {
    try {
        let input = String(p || '').trim();
        const wf = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0] ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
        if (input.length && !pathModule.isAbsolute(input) && wf) input = pathModule.join(wf, input);
        const candidates = [];
        if (input.length) {
            if (fs.existsSync(input)) {
                const st = fs.statSync(input);
                if (st.isFile()) candidates.push(input);
                else if (st.isDirectory()) {
                    ['metaeditor.exe', 'metaeditor64.exe', 'MetaEditor.exe', 'MetaEditor64.exe'].forEach(n => candidates.push(pathModule.join(input, n)));
                }
            } else {
                const d = pathModule.dirname(input);
                ['metaeditor.exe', 'metaeditor64.exe', 'MetaEditor.exe', 'MetaEditor64.exe'].forEach(n => candidates.push(pathModule.join(d, n)));
            }
        }
        const fallbacks = v === 5 ? [
            'C:\\Program Files\\MetaTrader 5\\metaeditor64.exe',
            'C:\\Program Files\\MetaTrader 5\\metaeditor.exe',
            'C:\\Program Files (x86)\\MetaTrader 5\\metaeditor.exe',
            'C:\\MT5_Install\\MetaTrader\\metaeditor.exe'
        ] : [
            'C:\\Program Files\\MetaTrader 4\\metaeditor.exe',
            'C:\\Program Files (x86)\\MetaTrader 4\\metaeditor.exe',
            'C:\\MT4_Install\\MetaTrader\\metaeditor.exe'
        ];
        candidates.push(...fallbacks);
        for (const c of candidates) {
            try {
                if (fs.existsSync(c)) { fs.accessSync(c, fs.constants.R_OK); return c; }
            } catch (e) { }
        }
        return input;
    } catch (e) {
        return p;
    }
}