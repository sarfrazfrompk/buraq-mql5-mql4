'use strict';
const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');
const ext = require("./extension");

function CreateProperties() {
    const config = vscode.workspace.getConfiguration();
    // Update settings in Workspace scope if available, otherwise Global
    const target = vscode.workspace.workspaceFolders ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;

    try {
        // 1. Files Exclude (Merge)
        const currentExclude = config.get('files.exclude') || {};
        const newExclude = {
            ...currentExclude,
            '**/*.ex4': true,
            '**/*.ex5': true
        };
        config.update('files.exclude', newExclude, target);

        // 2. Token Colors (Merge/Append)
        const currentColors = config.get('editor.tokenColorCustomizations') || {};
        // Ensure textMateRules exists
        const currentRules = currentColors.textMateRules || [];

        // Define our rules
        const newRules = [
            { scope: 'token.error.mql', settings: { foreground: '#F44747' } },
            { scope: 'token.done.mql', settings: { foreground: '#029c23d3' } },
            { scope: 'token.warning.mql', settings: { foreground: '#ff9d00' } },
            { scope: 'token.info.mql', settings: { foreground: '#0861fc' } },
            { scope: 'token.heading.mql', settings: { foreground: '#6796E6' } },
            { scope: 'comment.line.double-slash.mql', settings: { foreground: '#51ff00', fontStyle: 'italic' } },
            { scope: 'comment.block.mql', settings: { foreground: '#51ff00', fontStyle: 'italic' } }
        ];

        // Merge logic: Add new rules if they don't exist? Or just append?
        // Simple strategy: Filter out our known scopes from currentRules to avoid duplicates, then append ours.
        const ourScopes = new Set(newRules.map(r => r.scope));
        const filteredRules = currentRules.filter(r => !ourScopes.has(r.scope));

        const finalColors = {
            ...currentColors,
            textMateRules: [...filteredRules, ...newRules]
        };
        config.update('editor.tokenColorCustomizations', finalColors, target);

        // 3. File Associations (Merge)
        const currentAssociations = config.get('files.associations') || {};
        const newAssociations = {
            ...currentAssociations,
            '*.mqh': 'mqlh',
            '*.mq4': 'mql4',
            '*.mq5': 'mql5'
        };
        config.update('files.associations', newAssociations, target);

        // 4. C++ Squiggles (Overwrite is fine here as it's specific)
        config.update('C_Cpp.errorSquiggles', 'Disabled', target);

        vscode.window.showInformationMessage('Buraq MQL: Configurations successfully applied!');
    } catch (e) {
        vscode.window.showErrorMessage(`Buraq MQL: Failed to apply configurations. ${e.message}`);
    }
}

module.exports = {
    CreateProperties
}