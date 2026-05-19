'use strict';

const vscode = require('vscode');
const childProcess = require('child_process');
const fs = require('fs');
const pathModule = require('path');

// Status indicators for Buraq Terminal
const STATUS = {
    ERROR: '[ERROR]  ',
    WARNING: '[WARN]   ',
    SUCCESS: '[SUCCESS]',
    INFO: '[INFO]   ',
    STEP: '[STEP]   '
};

/**
 * Helper to format date elements
 */
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

/**
 * Find parent MQL file for header files (.mqh)
 */
function findParentFile(filePath, workspaceRoot) {
    try {
        const extension = pathModule.extname(filePath).toLowerCase();
        if (extension === '.mqh' && workspaceRoot) {
            if (!fs.existsSync(filePath)) return undefined;
            const content = fs.readFileSync(filePath, 'utf8');
            const firstLine = content.split('\n')[0] || '';
            let NameFileMQL, match, regEx = new RegExp('(\\/\\/###<).+(mq[4|5]>)', 'ig');
            while (match = regEx.exec(firstLine)) {
                NameFileMQL = match[0];
            }
            if (NameFileMQL !== undefined) {
                const relativePath = NameFileMQL.match(/(?<=<).+(?=>)/);
                if (relativePath) {
                    return pathModule.join(workspaceRoot, String(relativePath[0]));
                }
            }
        }
    } catch (e) {
        console.error('[compilerCore] Error finding parent file:', e);
    }
    return undefined;
}

/**
 * Resolve the path of the MetaEditor executable
 */
function resolveMetaEditorPath(v, p, workspaceRoot) {
    try {
        let input = String(p || '').trim();
        const wf = workspaceRoot || '';
        if (input.length && !pathModule.isAbsolute(input) && wf) {
            input = pathModule.join(wf, input);
        }

        const candidates = [];
        if (input.length) {
            if (fs.existsSync(input)) {
                const st = fs.statSync(input);
                if (st.isFile()) candidates.push(input);
                else if (st.isDirectory()) {
                    ['metaeditor.exe', 'metaeditor64.exe', 'MetaEditor.exe', 'MetaEditor64.exe']
                        .forEach(n => candidates.push(pathModule.join(input, n)));
                }
            } else {
                const d = pathModule.dirname(input);
                ['metaeditor.exe', 'metaeditor64.exe', 'MetaEditor.exe', 'MetaEditor64.exe']
                    .forEach(n => candidates.push(pathModule.join(d, n)));
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
                if (fs.existsSync(c)) {
                    fs.accessSync(c, fs.constants.R_OK);
                    return c;
                }
            } catch (e) { }
        }

        return input;
    } catch (e) {
        return p;
    }
}

/**
 * Core function to compile a single MQL file
 * Used by single-file keybindings, manual toolbar builds, and sequential workspace compilation queue
 */
async function compileFileCore(filePath, compileType, options = {}, diagnosticsManager, logFileManager) {
    return new Promise(async (resolve, reject) => {
        const logger = options.logger;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        if (logger && logger.initializeTerminal) {
            logger.initializeTerminal();
        }

        if (logger && logger.clearTerminal) {
            await logger.clearTerminal();
        }

        // Resolve parent file if compileType is compile/script and option is set
        let targetPath = filePath;
        if (options.parentFileSearch && compileType !== 0) {
            const parent = findParentFile(filePath, workspaceRoot);
            if (parent && fs.existsSync(parent)) {
                targetPath = parent;
            }
        }

        const fileName = pathModule.basename(targetPath);
        const extension = pathModule.extname(targetPath);
        const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
        const PathScript = pathModule.join(__dirname, '../../', 'mql-files', 'BuraqCompiler.exe');
        
        const workspaceName = vscode.workspace.name || '';
        const isMQL4 = workspaceName.includes('MQL4') || (targetPath.includes('MQL4') || targetPath.includes('mql4'));
        
        let MetaDir, incDir, logFile, command;
        
        // Load localization language mapping
        let lg;
        try {
            const language = vscode.env.language;
            lg = require(`../../landes.${language}.json`);
        } catch (e) {
            try {
                lg = require('../../landes.json');
            } catch (err) {
                lg = {};
            }
        }

        const CommM = isMQL4 ? (lg['path_editor4'] || 'Path editor 4 error') : (lg['path_editor5'] || 'Path editor 5 error');
        const CommI = isMQL4 ? (lg['path_include_4'] || 'Path include 4 error') : (lg['path_include_5'] || 'Path include 5 error');

        if (isMQL4) {
            MetaDir = resolveMetaEditorPath(4, config.Metaeditor?.Metaeditor4Dir, workspaceRoot);
            incDir = config.Metaeditor?.Include4Dir;
        } else {
            MetaDir = resolveMetaEditorPath(5, config.Metaeditor?.Metaeditor5Dir, workspaceRoot);
            incDir = config.Metaeditor?.Include5Dir;
        }

        const startT = new Date();
        const timeStr = `${tf(startT, 'h')}:${tf(startT, 'm')}:${tf(startT, 's')}`;
        
        let teq = '';
        switch (compileType) {
            case 0: teq = lg['checking'] || 'Checking'; break;
            case 1: teq = lg['compiling'] || 'Compiling'; break;
            case 2: teq = lg['comp_usi_script'] || 'Compiling via Script'; break;
        }

        if (logger) {
            if (logger.writeModernHeader) logger.writeModernHeader(extension, isMQL4);
            if (logger.writeSeparator) logger.writeSeparator();
            if (logger.writeFormattedLine) {
                logger.writeFormattedLine(STATUS.INFO, `Starting ${teq}`, `[${timeStr}]`);
                logger.writeFormattedLine(STATUS.STEP, `Target file`, fileName);
                logger.writeSeparator();
            }
        }

        const Nm = pathModule.basename(MetaDir);
        const Pm = pathModule.dirname(MetaDir);

        if (!(MetaDir && fs.existsSync(MetaDir))) {
            if (logger && logger.writeFormattedLine) {
                logger.writeFormattedLine(STATUS.ERROR, CommM, '');
                logger.writeFormattedLine(STATUS.ERROR, `Path not found`, MetaDir);
                logger.writeSeparator();
            }
            reject(new Error(`MetaEditor not found at: ${MetaDir}`));
            return;
        }

        let includefile = '';
        if (incDir && incDir.length) {
            if (!fs.existsSync(incDir)) {
                if (logger && logger.writeFormattedLine) {
                    logger.writeFormattedLine(STATUS.ERROR, CommI, '');
                    logger.writeFormattedLine(STATUS.ERROR, `Path not found`, incDir);
                    logger.writeSeparator();
                }
                reject(new Error(`Include folder not found at: ${incDir}`));
                return;
            } else {
                includefile = ` /include:"${incDir}"`;
            }
        }

        // Get log file path
        if (logFileManager) {
            logFile = logFileManager.getLogPath(targetPath);
        } else {
            const logDir = config.LogFile?.NameLog || '';
            if (logDir.length) {
                if (pathModule.extname(logDir) === '.log') {
                    logFile = targetPath.replace(fileName, logDir);
                } else {
                    logFile = targetPath.replace(fileName, logDir + '.log');
                }
            } else {
                logFile = targetPath.replace(fileName, fileName.match(/.+(?=\.)/) + '.log');
            }
        }

        // Compile command:
        // - Syntax checks (compileType === 0) compile silently using /s.
        // - Workspace queue compilations (options.silentWorkspace === true) compile silently using /s.
        // - Manual MQL build (compileType === 1) runs visible.
        // - Script automation MQL build (compileType === 2) uses /s if closeME is disabled.
        const cme = config.Script?.CloseME !== false;
        const useSilent = compileType === 0 || options.silentWorkspace || (compileType === 2 && !cme);
        const silentFlag = useSilent ? ' /s' : '';
        command = `"${MetaDir}" /compile:"${targetPath}"${includefile}${silentFlag} /log:"${logFile}"`;

        console.log('[compilerCore] Spawning compilation process:', command);

        childProcess.exec(command, { windowsHide: true }, (err, stdout, stderror) => {
            if (stderror) {
                if (logger && logger.writeFormattedLine) {
                    logger.writeFormattedLine(STATUS.ERROR, lg['editor64'] || 'Editor execution error', CommM);
                    logger.writeFormattedLine(STATUS.ERROR, `Current path`, MetaDir);
                    if (logger.writeSeparator) logger.writeSeparator();
                }
                reject(new Error(`MetaEditor stderror: ${stderror}`));
                return;
            }

            // Small delay to ensure the log file writing has completely flushed to disk
            setTimeout(() => {
                try {
                    if (!fs.existsSync(logFile)) {
                        throw new Error(`Log file was not generated by MetaEditor at: ${logFile}`);
                    }
                    const data = fs.readFileSync(logFile, 'utf16le');
                    
                    // Parse log using the diagnosticsManager
                    const log = diagnosticsManager.parseLog(data, targetPath);
                    const end = new Date();

                    // Cleanup the log file
                    if (config.LogFile?.DeleteLog !== false) {
                        try {
                            if (logFileManager) {
                                logFileManager.deleteLogSync(logFile);
                            } else {
                                fs.unlinkSync(logFile);
                            }
                        } catch (e) {
                            console.error('[compilerCore] Failed to delete log file:', e);
                        }
                    }

                    // Update centralized DiagnosticsManager database
                    if (diagnosticsManager) {
                        diagnosticsManager.setDiagnostics(targetPath, log.diagnosticsByFile);
                    }

                    // Print output lines to Terminal if we have a logger
                    if (logger && logger.writeToTerminal) {
                        logger.writeToTerminal(log.outputLines.join('\r\n'));
                    }

                    // Execute Python window automation helper for script compiles (rt === 2)
                    if (compileType === 2) {
                        if (!log.hasErrors) {
                            const mme = config.Script?.MiniME !== false;
                            const Timemini = config.Script?.Timetomini || 500;
                            const TimeClose = (Math.ceil((end - startT) * 0.01) * 100);
                            const scriptCmd = `"${PathScript}" "${MetaDir}" "${targetPath}" ${mme ? 1 : 0} ${Timemini} ${cme ? 1 : 0} ${TimeClose} ${Nm}`;
                            try {
                                childProcess.exec(scriptCmd);
                                if (logger && logger.writeToTerminal) {
                                    const colorizeInfo = (t) => `\x1b[34m${t}\x1b[0m`;
                                    const padText = (text, width) => {
                                        const visibleLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;
                                        const padding = width - visibleLen;
                                        return padding <= 0 ? text : text + ' '.repeat(padding);
                                    };
                                    logger.writeToTerminal(colorizeInfo(padText(STATUS.INFO, 12) + (lg['info_log_compile'] || 'Info: compiled and ran automation script')));
                                }
                            } catch (scriptErr) {
                                if (logger && logger.writeFormattedLine) {
                                    logger.writeFormattedLine(STATUS.ERROR, lg['err_start_script'] || 'Error starting script automation', '');
                                }
                            }
                        }
                    }

                    if (logger && logger.writeSeparator) {
                        logger.writeSeparator();
                    }

                    resolve({
                        success: !log.hasErrors,
                        errorCount: log.errorCount,
                        warningCount: log.warningCount,
                        outputLines: log.outputLines,
                        diagnosticsByFile: log.diagnosticsByFile
                    });

                } catch (readErr) {
                    if (logger && logger.writeFormattedLine) {
                        logger.writeFormattedLine(STATUS.ERROR, lg['err_read_log'] || 'Error reading log', String(readErr));
                        if (logger.writeSeparator) logger.writeSeparator();
                    }
                    vscode.window.showErrorMessage(`${lg['err_read_log'] || 'Error reading log'}: ${readErr}`);
                    reject(readErr);
                }
            }, 150);
        });
    });
}

module.exports = {
    resolveMetaEditorPath,
    compileFileCore
};
