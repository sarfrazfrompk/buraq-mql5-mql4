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
            console.log('[MQLDashboardProvider] Received message:', data.type);
            switch (data.type) {
                case 'compileAll':
                    vscode.commands.executeCommand('buraq_mql5_mql4.compileAllWorkspace');
                    break;
                case 'compileMain':
                    vscode.commands.executeCommand('buraq_mql5_mql4.compileMainFile');
                    break;
                case 'refresh':
                    this.update();
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
        let filesWithErrors = 0;
        const reports = [];

        if (this._diagnosticsManager && this._diagnosticsManager.dbPath && fs.existsSync(this._diagnosticsManager.dbPath)) {
            try {
                const db = JSON.parse(fs.readFileSync(this._diagnosticsManager.dbPath, 'utf8'));
                const compiledSources = Object.keys(db);
                const errorFiles = new Set();
                
                compiledSources.forEach(source => {
                    const errors = db[source];
                    errors.forEach(err => {
                        errorFiles.add(err.file);
                        if (err.severity === 'Error') totalErrors++;
                        else totalWarnings++;
                    });

                    reports.push({
                        source: path.basename(source),
                        fullPath: source,
                        errorCount: errors.filter(e => e.severity === 'Error').length,
                        warningCount: errors.filter(e => e.severity === 'Warning').length,
                        time: new Date().toLocaleTimeString()
                    });
                });

                filesWithErrors = errorFiles.size;
            } catch (e) {
                console.error('Error reading stats:', e);
            }
        }

        return {
            totalErrors,
            totalWarnings,
            filesWithErrors,
            reports: reports.slice(-10).reverse()
        };
    }

    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 10px; overflow-x: hidden; }
                    .card { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border); padding: 15px; border-radius: 5px; margin-bottom: 15px; }
                    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                    .stat-item { text-align: center; padding: 10px; background: var(--vscode-editor-background); border-radius: 4px; }
                    .stat-value { font-size: 20px; font-weight: bold; display: block; }
                    .stat-label { font-size: 10px; opacity: 0.8; text-transform: uppercase; }
                    .error { color: var(--vscode-errorForeground); }
                    .warning { color: var(--vscode-charts-yellow); }
                    .success { color: var(--vscode-charts-green); }
                    button { 
                        width: 100%; padding: 10px; margin-bottom: 8px; cursor: pointer;
                        background: var(--vscode-button-background); color: var(--vscode-button-foreground);
                        border: none; border-radius: 2px; position: relative;
                        transition: opacity 0.2s;
                    }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
                    button:disabled { opacity: 0.6; cursor: wait; }
                    .loading-spinner {
                        display: none;
                        width: 12px; height: 12px;
                        border: 2px solid rgba(255,255,255,0.3);
                        border-top-color: #fff;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                        position: absolute; right: 10px; top: 12px;
                    }
                    button.loading .loading-spinner { display: inline-block; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                    h3 { margin-top: 0; font-size: 14px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; }
                    .report-item { font-size: 12px; padding: 8px; border-bottom: 1px solid var(--vscode-panel-border); cursor: pointer; }
                    .report-item:hover { background: var(--vscode-list-hoverBackground); }
                    .report-meta { opacity: 0.7; font-size: 10px; display: flex; justify-content: space-between; margin-top: 4px; }
                    #current-file { color: var(--vscode-focusBorder); word-break: break-all; font-family: monospace; }
                </style>
            </head>
            <body>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span id="err-count" class="stat-value error">0</span>
                        <span class="stat-label">Errors</span>
                    </div>
                    <div class="stat-item">
                        <span id="warn-count" class="stat-value warning">0</span>
                        <span class="stat-label">Warnings</span>
                    </div>
                </div>

                <div id="compiling-card" class="card" style="display: none; border-color: var(--vscode-focusBorder);">
                    <h3 style="color: var(--vscode-focusBorder);">⚡ Compiling...</h3>
                    <div id="current-file" style="font-size: 11px; font-weight: bold;"></div>
                    <div style="font-size: 9px; opacity: 0.8; margin-top: 5px;">Buraq is processing your files</div>
                </div>

                <div class="card">
                    <h3>Actions</h3>
                    <button id="compileMain">
                        <span>Compile Main File (.mq5)</span>
                        <div class="loading-spinner"></div>
                    </button>
                    <button id="compileAll" class="secondary">
                        <span>Compile All Files</span>
                        <div class="loading-spinner"></div>
                    </button>
                    <button id="refresh" class="secondary" style="font-size: 10px; padding: 4px;">Refresh Dashboard</button>
                </div>

                <div class="card">
                    <h3>Recent Reports</h3>
                    <div id="reports-list">
                        <div style="opacity: 0.5; text-align: center; font-size: 11px; padding: 10px;">No recent compilations</div>
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

                        // Attach listeners directly to avoid DOMContentLoaded races
                        const setupButtons = () => {
                            const btnCompileAll = document.getElementById('compileAll');
                            const btnCompileMain = document.getElementById('compileMain');
                            const btnRefresh = document.getElementById('refresh');

                            if (btnCompileAll) {
                                btnCompileAll.onclick = () => {
                                    setLoading('compileAll', true);
                                    vscode.postMessage({ type: 'compileAll' });
                                };
                            }
                            if (btnCompileMain) {
                                btnCompileMain.onclick = () => {
                                    setLoading('compileMain', true);
                                    vscode.postMessage({ type: 'compileMain' });
                                };
                            }
                            if (btnRefresh) {
                                btnRefresh.onclick = () => vscode.postMessage({ type: 'refresh' });
                            }
                        };

                        window.addEventListener('message', event => {
                            const message = event.data;
                            if (message.type === 'updateStats') {
                                const stats = message.stats;
                                document.getElementById('err-count').textContent = stats.totalErrors;
                                document.getElementById('warn-count').textContent = stats.totalWarnings;
                                
                                const list = document.getElementById('reports-list');
                                if (stats.reports.length === 0) {
                                    list.innerHTML = '<div style="opacity: 0.5; text-align: center; font-size: 11px; padding: 10px;">No recent compilations</div>';
                                } else {
                                    list.innerHTML = stats.reports.map(r => {
                                        const safePath = r.fullPath.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
                                        return \`
                                            <div class="report-item" onclick="openFile('\${safePath}')">
                                                <div>\${r.source}</div>
                                                <div class="report-meta">
                                                    <span class="\${r.errorCount > 0 ? 'error' : 'success'}">\${r.errorCount} Errors, \${r.warningCount} Warnings</span>
                                                    <span>\${r.time}</span>
                                                </div>
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
                                    // Reset loading states when compilation finishes
                                    setLoading('compileAll', false);
                                    setLoading('compileMain', false);
                                }
                            }
                        });

                        window.openFile = function(path) {
                            vscode.postMessage({ type: 'openFile', filePath: path });
                        };

                        // Initialize
                        setupButtons();
                    })();
                </script>
            </body>
            </html>`;
    }
}

module.exports = MQLDashboardProvider;
