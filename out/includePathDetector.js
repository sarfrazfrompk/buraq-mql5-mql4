'use strict';
const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');

/**
 * Include Path Auto-Detector
 * Automatically detects MetaTrader include paths from common locations
 */

// Common MetaTrader installation paths
const MT5_COMMON_PATHS = [
    'C:\\Program Files\\MetaTrader 5',
    'C:\\Program Files (x86)\\MetaTrader 5',
    'C:\\MT5_Install\\MetaTrader',
    'D:\\MetaTrader 5',
    'D:\\Program Files\\MetaTrader 5'
];

const MT4_COMMON_PATHS = [
    'C:\\Program Files\\MetaTrader 4',
    'C:\\Program Files (x86)\\MetaTrader 4',
    'C:\\MT4_Install\\MetaTrader',
    'D:\\MetaTrader 4',
    'D:\\Program Files\\MetaTrader 4'
];

/**
 * Find MetaTrader data folders in AppData
 */
function findAppDataTerminals() {
    const results = { mt4: [], mt5: [] };

    try {
        const appData = process.env.APPDATA;
        if (!appData) return results;

        const metaQuotesPath = pathModule.join(appData, 'MetaQuotes', 'Terminal');

        if (fs.existsSync(metaQuotesPath)) {
            const terminals = fs.readdirSync(metaQuotesPath);

            for (const terminalId of terminals) {
                const terminalPath = pathModule.join(metaQuotesPath, terminalId);

                // Check for MQL5 folder
                const mql5Path = pathModule.join(terminalPath, 'MQL5');
                if (fs.existsSync(mql5Path)) {
                    const includePath = pathModule.join(mql5Path, 'Include');
                    if (fs.existsSync(includePath)) {
                        results.mt5.push({
                            terminalId,
                            path: includePath,
                            type: 'appdata'
                        });
                    }
                }

                // Check for MQL4 folder
                const mql4Path = pathModule.join(terminalPath, 'MQL4');
                if (fs.existsSync(mql4Path)) {
                    const includePath = pathModule.join(mql4Path, 'Include');
                    if (fs.existsSync(includePath)) {
                        results.mt4.push({
                            terminalId,
                            path: includePath,
                            type: 'appdata'
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error scanning AppData for terminals:', e);
    }

    return results;
}

/**
 * Find MetaTrader installations in common paths
 */
function findCommonInstallations() {
    const results = { mt4: [], mt5: [] };

    // Check MT5 paths
    for (const basePath of MT5_COMMON_PATHS) {
        const includePath = pathModule.join(basePath, 'MQL5', 'Include');
        if (fs.existsSync(includePath)) {
            results.mt5.push({
                path: includePath,
                type: 'installation'
            });
        }
    }

    // Check MT4 paths
    for (const basePath of MT4_COMMON_PATHS) {
        const includePath = pathModule.join(basePath, 'MQL4', 'Include');
        if (fs.existsSync(includePath)) {
            results.mt4.push({
                path: includePath,
                type: 'installation'
            });
        }
    }

    return results;
}

/**
 * Detect all available include paths
 */
function detectAllIncludePaths() {
    const appDataPaths = findAppDataTerminals();
    const commonPaths = findCommonInstallations();

    return {
        mt4: [...appDataPaths.mt4, ...commonPaths.mt4],
        mt5: [...appDataPaths.mt5, ...commonPaths.mt5]
    };
}

/**
 * Get the best include path for a given MQL version
 */
function getBestIncludePath(version) {
    const paths = detectAllIncludePaths();
    const versionPaths = version === 4 ? paths.mt4 : paths.mt5;

    // Prefer AppData paths (user-specific) over installation paths
    const appDataPath = versionPaths.find(p => p.type === 'appdata');
    if (appDataPath) return appDataPath.path;

    const installPath = versionPaths.find(p => p.type === 'installation');
    if (installPath) return installPath.path;

    return null;
}

/**
 * Command to show detected paths
 */
async function showDetectedPaths() {
    const paths = detectAllIncludePaths();

    const items = [];

    if (paths.mt5.length > 0) {
        items.push({ label: '--- MetaTrader 5 Include Paths ---', kind: vscode.QuickPickItemKind.Separator });
        for (const p of paths.mt5) {
            items.push({
                label: p.path,
                description: p.type === 'appdata' ? `Terminal: ${p.terminalId}` : 'Installation',
                path: p.path
            });
        }
    }

    if (paths.mt4.length > 0) {
        items.push({ label: '--- MetaTrader 4 Include Paths ---', kind: vscode.QuickPickItemKind.Separator });
        for (const p of paths.mt4) {
            items.push({
                label: p.path,
                description: p.type === 'appdata' ? `Terminal: ${p.terminalId}` : 'Installation',
                path: p.path
            });
        }
    }

    if (items.length === 0) {
        vscode.window.showInformationMessage('No MetaTrader installations found.');
        return;
    }

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Detected Include Paths (select to copy)',
        title: 'MetaTrader Include Paths'
    });

    if (selected && selected.path) {
        await vscode.env.clipboard.writeText(selected.path);
        vscode.window.showInformationMessage(`Copied to clipboard: ${selected.path}`);
    }
}

/**
 * Auto-configure include paths in settings
 */
async function autoConfigureIncludePaths() {
    const paths = detectAllIncludePaths();
    const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');

    let configured = false;

    // Auto-configure MT5
    if (paths.mt5.length > 0) {
        const currentMt5 = config.get('Metaeditor.Include5Dir');
        if (!currentMt5 || !fs.existsSync(currentMt5)) {
            const bestPath = getBestIncludePath(5);
            if (bestPath) {
                await config.update('Metaeditor.Include5Dir', bestPath, vscode.ConfigurationTarget.Global);
                configured = true;
            }
        }
    }

    // Auto-configure MT4
    if (paths.mt4.length > 0) {
        const currentMt4 = config.get('Metaeditor.Include4Dir');
        if (!currentMt4 || !fs.existsSync(currentMt4)) {
            const bestPath = getBestIncludePath(4);
            if (bestPath) {
                await config.update('Metaeditor.Include4Dir', bestPath, vscode.ConfigurationTarget.Global);
                configured = true;
            }
        }
    }

    if (configured) {
        vscode.window.showInformationMessage('Include paths auto-configured from detected MetaTrader installations.');
    }

    return configured;
}

module.exports = {
    detectAllIncludePaths,
    getBestIncludePath,
    showDetectedPaths,
    autoConfigureIncludePaths,
    findAppDataTerminals,
    findCommonInstallations
};
