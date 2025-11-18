'use strict';
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class ChartView {
    constructor(context) {
        this.context = context;
        this.panel = null;
    }

    createChartView() {
        // Check if branding is enabled
        const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
        const brandingEnabled = config.get('ShowChart.BrandingEnabled', true);
        
        if (!brandingEnabled) {
            vscode.window.showInformationMessage('MQL-Media branding is disabled in settings.');
            return;
        }

        // Verify file permissions for icon assets
        this.verifyIconAssets();

        // Create webview panel
        this.panel = vscode.window.createWebviewPanel(
            'mqlChartView',
            'MQL Chart with Branding',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Set HTML content
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'compile':
                        vscode.commands.executeCommand('buraq_mql5_mql4.compileFile');
                        setTimeout(() => { this.panel && this.panel.webview.postMessage({ command: 'done', action: 'compile' }); }, 500);
                        return;
                    case 'check':
                        vscode.commands.executeCommand('buraq_mql5_mql4.checkFile');
                        setTimeout(() => { this.panel && this.panel.webview.postMessage({ command: 'done', action: 'check' }); }, 500);
                        return;
                    case 'script':
                        vscode.commands.executeCommand('buraq_mql5_mql4.compileScript');
                        setTimeout(() => { this.panel && this.panel.webview.postMessage({ command: 'done', action: 'script' }); }, 500);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Handle panel disposal
        this.panel.onDidDispose(
            () => {
                this.panel = null;
            },
            null,
            this.context.subscriptions
        );
    }

    getWebviewContent() {
        // Get branding position from settings
        const config = vscode.workspace.getConfiguration('buraq_mql5_mql4');
        const brandingPosition = config.get('ShowChart.BrandingPosition', 'top-right');
        
        // Calculate positioning styles based on settings
        let positionStyles = '';
        switch (brandingPosition) {
            case 'top-right':
                positionStyles = 'right: 0px; top: 0px;';
                break;
            case 'top-left':
                positionStyles = 'left: 0px; top: 0px;';
                break;
            case 'bottom-right':
                positionStyles = 'right: 0px; bottom: 0px;';
                break;
            case 'bottom-left':
                positionStyles = 'left: 0px; bottom: 0px;';
                break;
            default:
                positionStyles = 'right: 0px; top: 0px;';
        }
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MQL Chart with Branding</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #1e1e1e;
        }
        
        #chart-container {
            position: relative;
            width: 100%;
            height: 100%;
        }
        
        #chart {
            width: 100%;
            height: 100%;
            background-color: #252526;
        }
        
        .mql-branding {
            position: absolute;
            ${positionStyles}
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            padding: 10px;
        }
        
        .mql-logo {
            width: 40px;
            height: 40px;
            margin-bottom: 5px;
            background-size: contain;
            background-repeat: no-repeat;
        }
        
        .mql-media-icons {
            display: flex;
            gap: 5px;
        }
        .media-button {
            width: 28px;
            height: 28px;
            background-size: contain;
            background-repeat: no-repeat;
            border: none;
            outline: none;
            cursor: pointer;
            border-radius: 4px;
            display: inline-block;
        }
        .media-button:hover { filter: brightness(1.2); }
        .media-button:active { transform: scale(0.95); }
        .media-button:focus { box-shadow: 0 0 0 2px #3d85c6; }
        .media-button.disabled { opacity: 0.5; cursor: not-allowed; }
        .media-button.loading { position: relative; }
        .media-button.loading::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 14px;
            height: 14px;
            margin: -7px 0 0 -7px;
            border: 2px solid #ccc;
            border-top-color: #3d85c6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .compile { background-image: url('${this.getUri('mql-media', 'compile-dark.svg')}'); }
        .check { background-image: url('${this.getUri('mql-media', 'check-dark.svg')}'); }
        .script { background-image: url('${this.getUri('mql-media', 'script-dark.svg')}'); }
    </style>
</head>
<body>
    <div id="chart-container">
        <div id="chart"></div>
        <div class="mql-branding">
            <div class="mql-logo" style="background-image: url('${this.getUri('mql-images', 'mql-icon.png')}');"></div>
            <div class="mql-media-icons">
                <button class="media-button compile" aria-label="Compile" title="Compile" tabindex="0" role="button"></button>
                <button class="media-button check" aria-label="Check" title="Check" tabindex="0" role="button"></button>
                <button class="media-button script" aria-label="Compile using script" title="Compile using script" tabindex="0" role="button"></button>
            </div>
        </div>
    </div>
    
    <script>
        const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;
        function setLoading(el, loading) {
            if (!el) return;
            if (loading) { el.classList.add('loading','disabled'); el.setAttribute('aria-busy','true'); el.setAttribute('disabled','true'); }
            else { el.classList.remove('loading','disabled'); el.removeAttribute('aria-busy'); el.removeAttribute('disabled'); }
        }
        function send(action) { if (!vscode) return; vscode.postMessage({ command: action }); }
        function bind(btn, action) {
            if (!btn) return;
            btn.addEventListener('click', () => { setLoading(btn, true); send(action); });
            btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLoading(btn, true); send(action); } });
        }
        const btnCompile = document.querySelector('.media-button.compile');
        const btnCheck = document.querySelector('.media-button.check');
        const btnScript = document.querySelector('.media-button.script');
        bind(btnCompile, 'compile');
        bind(btnCheck, 'check');
        bind(btnScript, 'script');
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (!msg || msg.command !== 'done') return;
            if (msg.action === 'compile') setLoading(btnCompile, false);
            if (msg.action === 'check') setLoading(btnCheck, false);
            if (msg.action === 'script') setLoading(btnScript, false);
        });
        window.addEventListener('error', function(e) {
            if (!vscode) return;
            vscode.postMessage({ command: 'alert', text: 'Error loading chart resources: ' + e.message });
        });
    </script>
</body>
</html>`;
    }

    getUri(folder, fileName) {
        const onDiskPath = vscode.Uri.file(
            path.join(this.context.extensionPath, folder, fileName)
        );
        return this.panel.webview.asWebviewUri(onDiskPath);
    }

    verifyIconAssets() {
        const iconPaths = [
            path.join(this.context.extensionPath, 'mql-images', 'mql-icon.png'),
            path.join(this.context.extensionPath, 'mql-media', 'compile-dark.svg'),
            path.join(this.context.extensionPath, 'mql-media', 'check-dark.svg'),
            path.join(this.context.extensionPath, 'mql-media', 'script-dark.svg')
        ];

        for (const iconPath of iconPaths) {
            if (!fs.existsSync(iconPath)) {
                vscode.window.showErrorMessage(`MQL-Media icon not found: ${iconPath}`);
                return false;
            }
            
            try {
                fs.accessSync(iconPath, fs.constants.R_OK);
            } catch (err) {
                vscode.window.showErrorMessage(`MQL-Media icon access denied: ${iconPath}`);
                return false;
            }
        }
        
        return true;
    }

    show() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        } else {
            this.createChartView();
        }
    }
}

module.exports = ChartView;