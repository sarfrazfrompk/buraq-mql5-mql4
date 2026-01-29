'use strict';
const vscode = require('vscode');
const childProcess = require('child_process');
const fs = require('fs');
const pathModule = require('path');
const https = require('https');
const sleep = require('util').promisify(setTimeout);
const language = vscode.env.language;
const ext = require("./extension");


function Help(sm) {
    // Check if there's an active editor
    if (!vscode.window.activeTextEditor) {
        vscode.window.showWarningMessage('No active editor. Please open an MQL file.');
        return undefined;
    }

    const { document, selection } = vscode.window.activeTextEditor, { start, end } = selection;
    if (end.line !== start.line) {
        vscode.window.showWarningMessage('Help works on single line selection. Please place cursor on a keyword.');
        return undefined;
    }
    const isSelectionSearch = end.line !== start.line || end.character !== start.character, wordAtCursorRange = isSelectionSearch ? selection : document.getWordRangeAtPosition(end, /(#\w+|\w+)/);
    if (wordAtCursorRange === undefined) {
        vscode.window.showWarningMessage('No keyword found at cursor position. Please place cursor on an MQL keyword.');
        return undefined;
    }

    const config = vscode.workspace.getConfiguration('buraq_mql5_mql4'), extension = pathModule.extname(document.fileName), PathKeyHH = pathModule.join(__dirname, '../', 'mql-files', 'BuraqKeys.exe'),
        wn = vscode.workspace.name.includes('MQL4'), helpval = config.Help.HelpVal, var_loc4 = config.Help.MQL4HelpLanguage, var_loc5 = config.Help.MQL5HelpLanguage, keyword = document.getText(wordAtCursorRange);

    let v, loc;

    if (extension === '.mq4' || (extension === '.mqh' && wn)) {
        v = 4; loc = var_loc4 === 'Default' ? (language === 'ru' ? '_russian' : '') : (var_loc4 === 'Русский' ? '_russian' : '');
    }
    else if (extension === '.mq5' || (extension === '.mqh' && !wn)) {
        v = 5;
        switch (var_loc5 === 'Default' ? language : var_loc5) {
            case (var_loc5 === 'Default' ? 'ru' : 'Русский'): loc = '_russian'; break;
            case (var_loc5 === 'Default' ? 'zh-cn' : 'Chinese'): loc = '_chinese'; break;
            case (var_loc5 === 'Default' ? 'zh-tw' : 'Chinese'): loc = '_chinese'; break;
            case (var_loc5 === 'Default' ? 'fr' : 'French'): loc = '_french'; break;
            case (var_loc5 === 'Default' ? 'de' : 'German'): loc = '_german'; break;
            case (var_loc5 === 'Default' ? 'it' : 'Italian'): loc = '_italian'; break;
            case (var_loc5 === 'Default' ? 'es' : 'Spanish'): loc = '_spanish'; break;
            case (var_loc5 === 'Default' ? 'ja' : 'Japanese'): loc = '_japanese'; break;
            case (var_loc5 === 'Default' ? 'pt-br' : 'Portuguese'): loc = '_portuguese'; break;
            case (var_loc5 === 'Default' ? 'tr' : 'Turkish'): loc = '_turkish'; break;
            default: loc = ''; break;
        }
    }
    else {
        vscode.window.showWarningMessage('Help is only available for MQL files (.mq4, .mq5, .mqh)');
        return undefined;
    }

    const PathHelp = pathModule.join(__dirname, '../', 'mql-files', 'help', 'mql' + v + '-help' + (loc ? loc.replace('_', '-') : '') + '.chm');

    // Check if help file exists
    if (!fs.existsSync(PathHelp)) {
        console.log('Help file not found:', PathHelp, '- attempting download');
        return download(v, loc);
    }

    // Check if BuraqKeys.exe exists
    if (!fs.existsSync(PathKeyHH)) {
        vscode.window.showErrorMessage(`BuraqKeys.exe not found at: ${PathKeyHH}. Cannot open help file.`);
        console.error('BuraqKeys.exe not found at:', PathKeyHH);
        return undefined;
    }

    console.log('Opening help file:', PathHelp, 'with keyword:', keyword);


    childProcess.exec(`tasklist /FI "IMAGENAME eq BuraqKeys.exe"`, (err, stdout) => {
        if (err) {
            console.error('Error checking for BuraqKeys.exe process:', err);
            vscode.window.showErrorMessage('Error checking for BuraqKeys.exe process. See console for details.');
            return;
        }

        if (stdout.includes("BuraqKeys.exe") != true) {
            // BuraqKeys not running, open help file directly to the keyword
            console.log('Starting BuraqKeys.exe with help file and searching for keyword:', keyword);
            childProcess.exec(`"${PathKeyHH}" -Mql -#klink "${keyword}" "${PathHelp}"`, (err) => {
                if (err) {
                    console.error('Error opening help file with keyword:', err);
                    vscode.window.showErrorMessage(`Failed to open help file: ${err.message}`);
                }
            });
        }
        else {
            // KeyHH already running, just search
            console.log('KeyHH.exe already running, searching for keyword:', keyword);
            childProcess.exec(`"${PathKeyHH}" -Mql -#klink "${keyword}" "${PathHelp}"`, (err) => {
                if (err) {
                    console.error('Error searching keyword in existing process:', err);
                    vscode.window.showErrorMessage(`Failed to search keyword: ${err.message}`);
                }
            });
        }
    });
}

function download(n, locname) {
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: ext.lg['help_Lo'],
        },
        () => {
            return new Promise((resolve) => {
                if (!fs.existsSync(pathModule.join(__dirname, '../', 'mql-files', 'help')))
                    fs.mkdirSync(pathModule.join(__dirname, '../', 'mql-files', 'help'));
                const helpFileName = 'mql' + n + '-help' + (locname ? locname.replace('_', '-') : '') + '.chm';
                const downloadUrl = 'https://raw.githubusercontent.com/sarfrazfrompk/buraq-mql5-mql4/main/mql-files/help/' + helpFileName;
                const req = https.get(downloadUrl,
                    (response) => {
                        if (response.statusCode === 200) {
                            const file = fs.createWriteStream(
                                pathModule.join(__dirname, '../', 'mql-files', 'help', helpFileName)
                            );
                            response.pipe(file);

                            file.on('error', (err) => {
                                console.error('Help file save error:', err);
                                return resolve(), vscode.window.showErrorMessage(ext.lg['help_er_save']);
                            });

                            file.on('finish', () => {
                                return file.close(), resolve(), Help(false);
                            });
                        } else {
                            console.error('Help file download failed. URL:', downloadUrl, 'Status:', response.statusCode);
                            return resolve(), vscode.window.showErrorMessage(`${ext.lg['help_er_statusCode']} ${response.statusCode}. URL: ${downloadUrl}`);
                        }
                    }
                );

                req.on('error', (err) => {
                    console.error('Help file download error:', err, 'URL:', downloadUrl);
                    return resolve(), vscode.window.showErrorMessage(`${ext.lg['help_er_noconnect']} URL: ${downloadUrl}`);
                });
            });
        }
    );
}

module.exports = {
    Help
}