'use strict';
const vscode = require('vscode');
const fs = require('fs');
const pathModule = require('path');

/**
 * Compiled File Diff
 * Compare metadata between .ex4/.ex5 compiled files
 */

/**
 * Read basic metadata from a compiled MQL file
 * Note: .ex4/.ex5 files are encrypted, but we can extract some header info
 */
function readCompiledFileInfo(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const buffer = fs.readFileSync(filePath);

        const ext = pathModule.extname(filePath).toLowerCase();
        const fileName = pathModule.basename(filePath);

        // Basic metadata
        const info = {
            fileName,
            filePath,
            extension: ext,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            modified: stats.mtime,
            modifiedFormatted: stats.mtime.toLocaleString(),
            created: stats.birthtime,
            createdFormatted: stats.birthtime.toLocaleString()
        };

        // Check magic bytes to verify it's a valid compiled file
        if (buffer.length >= 4) {
            info.magicBytes = buffer.slice(0, 4).toString('hex').toUpperCase();

            // MQL5 compiled files typically start with specific bytes
            if (ext === '.ex5') {
                info.type = 'MQL5 Compiled';
                info.version = 5;
            } else if (ext === '.ex4') {
                info.type = 'MQL4 Compiled';
                info.version = 4;
            }
        }

        // Calculate simple checksum for comparison
        let checksum = 0;
        for (let i = 0; i < buffer.length; i++) {
            checksum = ((checksum << 5) - checksum + buffer[i]) | 0;
        }
        info.checksum = Math.abs(checksum).toString(16).toUpperCase();

        return info;
    } catch (e) {
        console.error('Error reading compiled file:', e);
        return null;
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Compare two compiled files
 */
function compareCompiledFiles(file1Path, file2Path) {
    const info1 = readCompiledFileInfo(file1Path);
    const info2 = readCompiledFileInfo(file2Path);

    if (!info1 || !info2) {
        return { error: 'Could not read one or both files' };
    }

    const differences = [];

    if (info1.size !== info2.size) {
        differences.push({
            property: 'Size',
            file1: info1.sizeFormatted,
            file2: info2.sizeFormatted,
            diff: `${info2.size - info1.size > 0 ? '+' : ''}${info2.size - info1.size} bytes`
        });
    }

    if (info1.checksum !== info2.checksum) {
        differences.push({
            property: 'Checksum',
            file1: info1.checksum,
            file2: info2.checksum,
            diff: 'Different'
        });
    }

    const timeDiff = info2.modified.getTime() - info1.modified.getTime();
    if (timeDiff !== 0) {
        differences.push({
            property: 'Modified',
            file1: info1.modifiedFormatted,
            file2: info2.modifiedFormatted,
            diff: timeDiff > 0 ? 'File 2 is newer' : 'File 1 is newer'
        });
    }

    return {
        file1: info1,
        file2: info2,
        identical: differences.length === 0,
        differences
    };
}

/**
 * Show compiled file info command
 */
async function showCompiledFileInfo() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
    }

    const filePath = editor.document.fileName;
    const ext = pathModule.extname(filePath).toLowerCase();

    // Check for source file and find corresponding compiled file
    let compiledPath = filePath;
    if (ext === '.mq5') {
        compiledPath = filePath.replace('.mq5', '.ex5');
    } else if (ext === '.mq4') {
        compiledPath = filePath.replace('.mq4', '.ex4');
    } else if (ext !== '.ex4' && ext !== '.ex5') {
        vscode.window.showWarningMessage('Select an MQL source or compiled file');
        return;
    }

    if (!fs.existsSync(compiledPath)) {
        vscode.window.showWarningMessage(`Compiled file not found: ${pathModule.basename(compiledPath)}`);
        return;
    }

    const info = readCompiledFileInfo(compiledPath);
    if (!info) {
        vscode.window.showErrorMessage('Could not read compiled file');
        return;
    }

    const message = `**${info.fileName}**\n` +
        `Type: ${info.type}\n` +
        `Size: ${info.sizeFormatted}\n` +
        `Modified: ${info.modifiedFormatted}\n` +
        `Checksum: ${info.checksum}`;

    vscode.window.showInformationMessage(
        `${info.fileName}: ${info.sizeFormatted}, Modified: ${info.modifiedFormatted}`,
        'Copy Info'
    ).then(selection => {
        if (selection === 'Copy Info') {
            vscode.env.clipboard.writeText(message);
        }
    });
}

/**
 * Compare two compiled files command
 */
async function compareCompiledFilesCommand() {
    // Get first file
    const file1 = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Compiled MQL': ['ex4', 'ex5'] },
        title: 'Select first compiled file'
    });

    if (!file1 || file1.length === 0) return;

    // Get second file
    const file2 = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Compiled MQL': ['ex4', 'ex5'] },
        title: 'Select second compiled file to compare'
    });

    if (!file2 || file2.length === 0) return;

    const result = compareCompiledFiles(file1[0].fsPath, file2[0].fsPath);

    if (result.error) {
        vscode.window.showErrorMessage(result.error);
        return;
    }

    if (result.identical) {
        vscode.window.showInformationMessage('Files are identical (same size and checksum)');
    } else {
        const diffText = result.differences.map(d =>
            `${d.property}: ${d.file1} → ${d.file2} (${d.diff})`
        ).join('\n');

        vscode.window.showInformationMessage(
            `Found ${result.differences.length} difference(s)`,
            'Show Details'
        ).then(selection => {
            if (selection === 'Show Details') {
                vscode.window.showInformationMessage(diffText, { modal: true });
            }
        });
    }
}

module.exports = {
    readCompiledFileInfo,
    compareCompiledFiles,
    showCompiledFileInfo,
    compareCompiledFilesCommand
};
