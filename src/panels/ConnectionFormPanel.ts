import * as vscode from 'vscode';
import { ConnectionConfig } from '../types';

export class ConnectionFormPanel {
    private static panel: vscode.WebviewPanel | undefined;
    private static onSubmitCallback: ((config: ConnectionConfig) => void) | undefined;
    private static editConfig: ConnectionConfig | undefined;

    static show(
        context: vscode.ExtensionContext,
        onSubmit: (config: ConnectionConfig) => void,
        editConfig?: ConnectionConfig
    ): void {
        this.onSubmitCallback = onSubmit;
        this.editConfig = editConfig;

        if (this.panel) {
            this.panel.reveal();
            this.panel.title = editConfig ? 'Edit Connection' : 'Add Connection';
            this.updateHtml();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'dbvectorConnectionForm',
            editConfig ? 'Edit Connection' : 'Add Connection',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        this.panel.onDidDispose(() => { this.panel = undefined; });

        this.panel.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'submit' && this.onSubmitCallback) {
                const config: ConnectionConfig = {
                    id: this.editConfig?.id || `conn_${Date.now()}`,
                    name: msg.data.name,
                    host: msg.data.host,
                    port: parseInt(msg.data.port),
                    username: msg.data.username || undefined,
                    password: msg.data.password || undefined,
                };
                this.onSubmitCallback(config);
                this.panel?.dispose();
            } else if (msg.command === 'cancel') {
                this.panel?.dispose();
            }
        });

        this.updateHtml();
    }

    private static updateHtml(): void {
        if (!this.panel) return;
        const cfg = this.editConfig;
        const isEdit = !!cfg;

        this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-foreground);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --input-fg: var(--vscode-input-foreground);
            --btn-bg: var(--vscode-button-background);
            --btn-fg: var(--vscode-button-foreground);
            --btn-hover: var(--vscode-button-hoverBackground);
            --btn-secondary-bg: var(--vscode-button-secondaryBackground);
            --btn-secondary-fg: var(--vscode-button-secondaryForeground);
            --focus: var(--vscode-focusBorder);
            --error: var(--vscode-errorForeground);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--fg); background: var(--bg); padding: 40px; display: flex; justify-content: center; }
        .container { width: 100%; max-width: 480px; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 6px; }
        .subtitle { color: var(--vscode-descriptionForeground); margin-bottom: 28px; }
        .form-group { margin-bottom: 18px; }
        label { display: block; font-weight: 500; margin-bottom: 5px; }
        .required::after { content: ' *'; color: var(--error); }
        input { width: 100%; padding: 8px 10px; background: var(--input-bg); border: 1px solid var(--input-border); color: var(--input-fg); border-radius: 4px; font-size: 13px; }
        input:focus { outline: none; border-color: var(--focus); }
        .row { display: flex; gap: 12px; }
        .row .form-group { flex: 1; }
        .hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 3px; }
        .divider { border-top: 1px solid var(--vscode-widget-border); margin: 20px 0; }
        .section-title { font-size: 12px; font-weight: 600; margin-bottom: 14px; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.5px; }
        .buttons { display: flex; gap: 10px; margin-top: 28px; }
        .btn { padding: 9px 18px; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 500; }
        .btn-primary { background: var(--btn-bg); color: var(--btn-fg); flex: 1; }
        .btn-primary:hover { background: var(--btn-hover); }
        .btn-secondary { background: var(--btn-secondary-bg); color: var(--btn-secondary-fg); }
        .icon { font-size: 32px; margin-bottom: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔌</div>
        <h1>${isEdit ? 'Edit Connection' : 'New Connection'}</h1>
        <p class="subtitle">${isEdit ? 'Update your Milvus server settings' : 'Connect to a Milvus vector database'}</p>
        
        <form id="form">
            <div class="form-group">
                <label class="required">Connection Name</label>
                <input type="text" id="name" value="${cfg?.name || ''}" placeholder="My Milvus Server" required>
                <div class="hint">A friendly name to identify this connection</div>
            </div>

            <div class="row">
                <div class="form-group">
                    <label class="required">Host</label>
                    <input type="text" id="host" value="${cfg?.host || '127.0.0.1'}" placeholder="127.0.0.1" required>
                </div>
                <div class="form-group" style="max-width: 100px;">
                    <label class="required">Port</label>
                    <input type="number" id="port" value="${cfg?.port || 19530}" required>
                </div>
            </div>

            <div class="divider"></div>
            <div class="section-title">Authentication (Optional)</div>

            <div class="row">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="username" value="${cfg?.username || ''}" placeholder="root">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" value="${cfg?.password || ''}" placeholder="••••••••">
                </div>
            </div>

            <div class="buttons">
                <button type="button" class="btn btn-secondary" onclick="vscode.postMessage({command:'cancel'})">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Connect'}</button>
            </div>
        </form>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('form').addEventListener('submit', (e) => {
            e.preventDefault();
            vscode.postMessage({
                command: 'submit',
                data: {
                    name: document.getElementById('name').value,
                    host: document.getElementById('host').value,
                    port: document.getElementById('port').value,
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value,
                }
            });
        });
    </script>
</body>
</html>`;
    }
}
