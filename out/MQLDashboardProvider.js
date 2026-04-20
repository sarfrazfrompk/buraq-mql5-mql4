'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class MQLDashboardProvider {
    constructor(extensionUri, diagnosticsManager) {
        this._extensionUri = extensionUri;
        this._diagnosticsManager = diagnosticsManager;
        this._view = null;
    }

    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'compileAll':
                    vscode.commands.executeCommand('buraq_mql5_mql4.compileAllWorkspace');
                    break;
                case 'compileMain':
                    vscode.commands.executeCommand('buraq_mql5_mql4.compileMainFile');
                    break;
                case 'openFile':
                    if (data.filePath) {
                        const uri = vscode.Uri.file(data.filePath);
                        vscode.workspace.openTextDocument(uri).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                    break;
            }
        });

        // Initial update
        this.update();
    }

    update() {
        if (!this._view) return;
        const stats = this._getStats();
        this._view.webview.postMessage({ type: 'updateStats', stats });
    }

    setCompiling(filePath) {
        if (!this._view) return;
        const fileName = filePath ? path.basename(filePath) : null;
        this._view.webview.postMessage({ type: 'compiling', fileName });
    }

    _getStats() {
        let totalErrors = 0;
        let totalWarnings = 0;
        const fileIssueMap = new Map(); // Map<actualFilePath, {errors: number, warnings: number}>

        if (this._diagnosticsManager && this._diagnosticsManager.dbPath && fs.existsSync(this._diagnosticsManager.dbPath)) {
            try {
                const db = JSON.parse(fs.readFileSync(this._diagnosticsManager.dbPath, 'utf8'));
                
                Object.keys(db).forEach(source => {
                    const errors = db[source];
                    if (!Array.isArray(errors)) return;

                    errors.forEach(err => {
                        const filePath = err.file;
                        // NO DE-DUPLICATION: Every entry in the DB contributes to the count
                        
                        if (!fileIssueMap.has(filePath)) {
                            fileIssueMap.set(filePath, { errors: 0, warnings: 0 });
                        }

                        const fileStats = fileIssueMap.get(filePath);
                        if (err.severity === 'Error') {
                            totalErrors++;
                            fileStats.errors++;
                        } else {
                            totalWarnings++;
                            fileStats.warnings++;
                        }
                    });
                });
            } catch (e) {
                console.error('Error reading stats:', e);
            }
        }

        const reports = [];
        fileIssueMap.forEach((stats, filePath) => {
            if (stats.errors > 0 || stats.warnings > 0) {
                reports.push({
                    source: path.basename(filePath),
                    fullPath: filePath,
                    errorCount: stats.errors,
                    warningCount: stats.warnings,
                    time: 'Active'
                });
            }
        });

        // Sort: Most errors first
        reports.sort((a, b) => {
            if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
            return b.warningCount - a.warningCount;
        });

        return {
            totalErrors: totalErrors,
            totalWarnings: totalWarnings,
            totalProblems: totalErrors + totalWarnings,
            filesWithErrors: fileIssueMap.size,
            reports: reports
        };
    }


    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    :root {
                        --container-padding: 12px;
                        --card-radius: 6px;
                    }
                    body { 
                        font-family: var(--vscode-font-family); 
                        color: var(--vscode-foreground); 
                        padding: var(--container-padding); 
                        background-color: var(--vscode-sideBar-background);
                        overflow-x: hidden;
                        font-size: var(--vscode-font-size);
                    }
                    
                    /* Stats Cards */
                    .overview { margin-bottom: 20px; }
                    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
                    
                    .stat-card {
                        background: var(--vscode-sideBarSectionHeader-background);
                        padding: 12px;
                        border-radius: var(--card-radius);
                        border: 1px solid var(--vscode-panel-border);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        transition: transform 0.1s;
                    }
                    
                    .stat-card.wide { grid-column: span 2; padding: 15px; border-bottom: 3px solid var(--vscode-button-background); }
                    .stat-card.error { border-bottom: 3px solid var(--vscode-errorForeground); }
                    .stat-card.warning { border-bottom: 3px solid var(--vscode-charts-yellow); }
                    
                    .stat-value { font-size: 22px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
                    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
                    
                    /* Compile Status */
                    #compiling-card {
                        background: var(--vscode-editor-background);
                        border: 1px dashed var(--vscode-focusBorder);
                        padding: 12px;
                        border-radius: var(--card-radius);
                        margin-bottom: 20px;
                        animation: pulse 2s infinite ease-in-out;
                    }
                    @keyframes pulse {
                        0% { opacity: 0.8; } 50% { opacity: 1; border-color: var(--vscode-button-background); } 100% { opacity: 0.8; }
                    }
                    
                    .status-header { display: flex; align-items: center; gap: 8px; color: var(--vscode-focusBorder); margin-bottom: 6px; }
                    .spinner-small { width: 12px; height: 12px; border: 2px solid var(--vscode-focusBorder); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
                    
                    /* Buttons */
                    .actions { margin-bottom: 24px; }
                    .section-title { font-size: 11px; font-weight: 600; opacity: 0.6; margin-bottom: 10px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
                    .section-title::after { content: ""; flex: 1; height: 1px; background: var(--vscode-panel-border); }
                    
                    button {
                        width: 100%;
                        padding: 8px 12px;
                        margin-bottom: 8px;
                        cursor: pointer;
                        border: none;
                        border-radius: var(--card-radius);
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        gap: 8px;
                        font-weight: 500;
                        transition: filter 0.2s;
                    }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
                    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
                    
                    button:disabled { opacity: 0.6; cursor: not-allowed; }
                    .loading-spinner {
                        display: none;
                        width: 14px; height: 14px;
                        border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    button.loading .loading-spinner { display: block; }
                    button.loading span { opacity: 0.7; }
                    
                    @keyframes spin { to { transform: rotate(360deg); } }
                    
                    /* Reports List */
                    .reports-container { max-height: 400px; overflow-y: auto; padding-right: 4px; }
                    .report-item {
                        background: var(--vscode-editor-background);
                        padding: 14px 12px;
                        border-radius: var(--card-radius);
                        border: 1px solid var(--vscode-panel-border);
                        margin-bottom: 10px;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    }
                    .report-item:hover { 
                        border-color: var(--vscode-focusBorder); 
                        background: var(--vscode-list-hoverBackground);
                        transform: translateY(-1px);
                    }
                    
                    .report-header { display: flex; justify-content: space-between; align-items: flex-start; }
                    .file-name { font-weight: 600; font-size: 13px; color: var(--vscode-button-background); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
                    .report-time { font-size: 10px; opacity: 0.6; font-family: monospace; }
                    
                    .report-badges { display: flex; gap: 6px; margin-top: 2px; }
                    .badge {
                        padding: 1px 6px;
                        border-radius: 10px;
                        font-size: 9px;
                        font-weight: 700;
                        display: flex;
                        align-items: center;
                        gap: 3px;
                    }
                    .badge.error { background: var(--vscode-errorForeground); color: white; }
                    .badge.warning { background: var(--vscode-charts-yellow); color: black; }
                    .badge.success { background: var(--vscode-charts-green); color: white; }
                    
                    .empty-state { text-align: center; padding: 30px 10px; opacity: 0.4; font-size: 11px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="overview">
                    <div class="section-title">Workspace Health</div>
                    <div class="stats-grid">
                        <div class="stat-card wide">
                            <span id="total-count" class="stat-value">0</span>
                            <span class="stat-label">Issues Found</span>
                        </div>
                        <div class="stat-card error">
                            <span id="err-count" class="stat-value" style="color: var(--vscode-errorForeground)">0</span>
                            <span class="stat-label">Errors</span>
                        </div>
                        <div class="stat-card warning">
                            <span id="warn-count" class="stat-value" style="color: var(--vscode-charts-yellow)">0</span>
                            <span class="stat-label">Warnings</span>
                        </div>
                    </div>
                </div>

                <div id="compiling-card" style="display: none;">
                    <div class="status-header">
                        <div class="spinner-small"></div>
                        <span style="font-weight: 600; font-size: 12px;">Active Compilation</span>
                    </div>
                    <div id="current-file" style="font-family: monospace; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                </div>

                <div class="actions">
                    <div class="section-title">Commands</div>
                    <button id="compileMain">
                        <div class="loading-spinner"></div>
                        <span>Build Main (.mq5)</span>
                    </button>
                    <button id="compileAll" class="secondary">
                        <div class="loading-spinner"></div>
                        <span>Compile Workspace</span>
                    </button>
                </div>

                <div class="reports">
                    <div class="section-title">Recent Activity</div>
                    <div id="reports-list" class="reports-container">
                        <div class="empty-state">No compilation history found</div>
                    </div>
                </div>

                <script>
                    (function() {
                        const vscode = acquireVsCodeApi();
                        
                        function setLoading(buttonId, isLoading) {
                            const btn = document.getElementById(buttonId);
                            if (!btn) return;
                            if (isLoading) {
                                btn.classList.add('loading');
                                btn.disabled = true;
                            } else {
                                btn.classList.remove('loading');
                                btn.disabled = false;
                            }
                        }

                        function init() {
                            document.getElementById('compileAll').onclick = () => {
                                setLoading('compileAll', true);
                                vscode.postMessage({ type: 'compileAll' });
                            };
                            document.getElementById('compileMain').onclick = () => {
                                setLoading('compileMain', true);
                                vscode.postMessage({ type: 'compileMain' });
                            };
                        }

                        window.addEventListener('message', event => {
                            const message = event.data;
                            if (message.type === 'updateStats') {
                                const stats = message.stats;
                                document.getElementById('err-count').textContent = stats.totalErrors;
                                document.getElementById('warn-count').textContent = stats.totalWarnings;
                                document.getElementById('total-count').textContent = stats.totalProblems;
                                
                                const list = document.getElementById('reports-list');
                                if (stats.reports.length === 0) {
                                    list.innerHTML = '<div class="empty-state">No compilation history found</div>';
                                } else {
                                    list.innerHTML = stats.reports.map(r => {
                                        const safePath = r.fullPath.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
                                        let badgeHtml = '';
                                        if (r.errorCount > 0 || r.warningCount > 0) {
                                            if (r.errorCount > 0) badgeHtml += \`<span class="badge error">\${r.errorCount} E</span>\`;
                                            if (r.warningCount > 0) badgeHtml += \`<span class="badge warning">\${r.warningCount} W</span>\`;
                                        } else {
                                            badgeHtml = \`<span class="badge success">CLEAN</span>\`;
                                        }
                                        
                                        return \`
                                            <div class="report-item" onclick="openFile('\${safePath}')">
                                                <div class="report-header">
                                                    <div class="file-name">\${r.source}</div>
                                                    <div class="report-time">\${r.time}</div>
                                                </div>
                                                <div class="report-badges">\${badgeHtml}</div>
                                            </div>
                                        \`;
                                    }).join('');
                                }
                            } else if (message.type === 'compiling') {
                                const card = document.getElementById('compiling-card');
                                const fileName = document.getElementById('current-file');
                                if (message.fileName) {
                                    card.style.display = 'block';
                                    fileName.textContent = message.fileName;
                                } else {
                                    card.style.display = 'none';
                                    setLoading('compileAll', false);
                                    setLoading('compileMain', false);
                                }
                            }
                        });

                        window.openFile = function(path) {
                            vscode.postMessage({ type: 'openFile', filePath: path });
                        };

                        init();
                    })();
                </script>
            </body>
            </html>`;
    }
}

module.exports = MQLDashboardProvider;
