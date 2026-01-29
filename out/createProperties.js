'use strict';
const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');
const ext = require("./extension");

function CreateProperties() {
    const config = vscode.workspace.getConfiguration();

    // ex4/ex5 are not readable, hide them by default for cleaner explorer
    const excludeFiles = {
        '**/*.ex4': true,
        '**/*.ex5': true,
    };

    const tokenColorCustomizations = {
        textMateRules: [
            { scope: 'token.error.mql', settings: { foreground: '#F44747' } },
            { scope: 'token.done.mql', settings: { foreground: '#029c23d3' } },
            { scope: 'token.warning.mql', settings: { foreground: '#ff9d00' } },
            { scope: 'token.info.mql', settings: { foreground: '#0861fc' } },
            { scope: 'token.heading.mql', settings: { foreground: '#6796E6' } },
        ],
    };

    const fileAssociations = {
        '*.mqh': 'mqlh',
        '*.mq4': 'mql4',
        '*.mq5': 'mql5'
    };

    // Update settings in Workspace scope if available, otherwise Global
    const target = vscode.workspace.workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;

    config.update('files.associations', fileAssociations, target);
    config.update('editor.tokenColorCustomizations', tokenColorCustomizations, target);
    config.update('files.exclude', excludeFiles, target);

    // Explicitly disable C++ squiggles for these files just in case
    config.update('C_Cpp.errorSquiggles', 'Disabled', target);
}

module.exports = {
    CreateProperties
}