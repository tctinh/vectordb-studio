import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { DataPage } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class DataViewerPanel {
    private static panels = new Map<string, DataViewerPanel>();
    
    private panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private currentPage: DataPage | null = null;
    private partitions: string[] = [];
    private currentFilter: string = '';
    private currentPartition: string = '_all';

    private constructor(
        private context: vscode.ExtensionContext,
        private manager: ConnectionManager,
        private connectionId: string,
        private database: string,
        private collection: string,
        private initialPartition?: string
    ) {
        this.panel = vscode.window.createWebviewPanel(
            'dbvectorData',
            `📊 ${collection}`,
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(m => this.onMessage(m), null, this.disposables);

        if (initialPartition) {
            this.currentPartition = initialPartition;
        }

        this.initialize();
    }

    static show(
        context: vscode.ExtensionContext,
        manager: ConnectionManager,
        connectionId: string,
        database: string,
        collection: string,
        partition?: string
    ): void {
        const key = `${connectionId}:${database}:${collection}${partition ? ':' + partition : ''}`;
        
        if (this.panels.has(key)) {
            this.panels.get(key)!.panel.reveal();
            return;
        }

        const panel = new DataViewerPanel(context, manager, connectionId, database, collection, partition);
        this.panels.set(key, panel);
    }

    private async initialize(): Promise<void> {
        const client = this.manager.getClient(this.connectionId);
        if (!client) return;

        try {
            await client.useDatabase(this.database);
            this.partitions = await client.listPartitions(this.collection);
            await this.loadPage(0);
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to initialize: ${e}`);
        }
    }

    private async loadPage(offset: number, limit: number = 50): Promise<void> {
        const client = this.manager.getClient(this.connectionId);
        if (!client) return;

        try {
            await client.useDatabase(this.database);
            
            const partitionNames = this.currentPartition === '_all' ? undefined : [this.currentPartition];
            this.currentPage = await client.queryDataWithPartition(
                this.collection, 
                offset, 
                limit, 
                this.currentFilter,
                partitionNames
            );
            this.updateHtml();
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to load data: ${e}`);
        }
    }

    private async onMessage(msg: { command: string; offset?: number; limit?: number; filter?: string; partition?: string }): Promise<void> {
        switch (msg.command) {
            case 'page':
                if (msg.filter !== undefined) this.currentFilter = msg.filter;
                if (msg.partition !== undefined) this.currentPartition = msg.partition;
                await this.loadPage(msg.offset || 0, msg.limit || 50);
                break;
            case 'query':
                this.currentFilter = msg.filter || '';
                this.currentPartition = msg.partition || '_all';
                await this.loadPage(0);
                break;
            case 'refresh':
                await this.loadPage(this.currentPage?.offset || 0);
                break;
            case 'export':
                await this.exportData();
                break;
        }
    }

    private async exportData(): Promise<void> {
        const client = this.manager.getClient(this.connectionId);
        if (!client) return;

        const total = this.currentPage?.total || 0;
        if (total === 0) {
            vscode.window.showWarningMessage('No data to export');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || require('os').homedir();
        const defaultPath = require('path').join(workspaceFolder, `${this.collection}_export.json`);
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultPath),
            filters: { 'JSON': ['json'] },
            title: `Export ${total.toLocaleString()} rows to JSON`
        });

        if (!uri) return;

        try {
            await client.useDatabase(this.database);
            const partitionNames = this.currentPartition === '_all' ? undefined : [this.currentPartition];
            
            const allRows: any[] = [];
            const batchSize = 1000;
            const totalBatches = Math.ceil(total / batchSize);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Exporting data...',
                cancellable: true
            }, async (progress, token) => {
                for (let i = 0; i < totalBatches; i++) {
                    if (token.isCancellationRequested) {
                        throw new Error('Export cancelled');
                    }

                    const offset = i * batchSize;
                    progress.report({ 
                        message: `Fetching ${offset.toLocaleString()} - ${Math.min(offset + batchSize, total).toLocaleString()} of ${total.toLocaleString()}`,
                        increment: (100 / totalBatches)
                    });

                    const batch = await client.queryDataWithPartition(
                        this.collection,
                        offset,
                        batchSize,
                        this.currentFilter,
                        partitionNames
                    );
                    
                    allRows.push(...batch.rows);
                    
                    if (batch.rows.length < batchSize) break;
                }
            });

            fs.writeFileSync(uri.fsPath, JSON.stringify(allRows, null, 2));
            vscode.window.showInformationMessage(`Exported ${allRows.length.toLocaleString()} rows to ${path.basename(uri.fsPath)}`);
        } catch (e) {
            vscode.window.showErrorMessage(`Export failed: ${e}`);
        }
    }

    private updateHtml(): void {
        if (!this.currentPage) return;
        
        const { rows, total, offset, limit, columns } = this.currentPage;
        const currentPageNum = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(total / limit) || 1;

        const partitionOptions = ['_all', ...this.partitions.filter(p => p !== '_all')]
            .map(p => `<option value="${p}" ${p === this.currentPartition ? 'selected' : ''}>${p === '_all' ? 'All Partitions' : p}</option>`)
            .join('');

        this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-foreground);
            --border: var(--vscode-widget-border);
            --header-bg: var(--vscode-editorGroupHeader-tabsBackground);
            --hover: var(--vscode-list-hoverBackground);
            --btn-bg: var(--vscode-button-background);
            --btn-fg: var(--vscode-button-foreground);
            --btn-hover: var(--vscode-button-hoverBackground);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --input-fg: var(--vscode-input-foreground);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--fg); background: var(--bg); padding: 16px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 600; }
        .toolbar { display: flex; gap: 8px; }
        .btn { padding: 6px 12px; background: var(--btn-bg); color: var(--btn-fg); border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
        .btn:hover { background: var(--btn-hover); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .filter-bar { display: flex; gap: 10px; margin-bottom: 12px; padding: 12px; background: var(--header-bg); border-radius: 6px; align-items: center; flex-wrap: wrap; }
        .filter-group { display: flex; align-items: center; gap: 6px; }
        .filter-group label { font-size: 12px; color: var(--vscode-descriptionForeground); white-space: nowrap; }
        select, input[type="text"] { padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--input-border); color: var(--input-fg); border-radius: 4px; font-size: 12px; }
        select { min-width: 140px; }
        input[type="text"] { flex: 1; min-width: 250px; }
        .filter-hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-left: auto; }
        
        .stats { color: var(--vscode-descriptionForeground); font-size: 12px; margin-bottom: 10px; }
        .table-container { overflow-x: auto; border: 1px solid var(--border); border-radius: 4px; max-height: 60vh; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: var(--header-bg); font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 1; }
        td { padding: 8px 12px; border-bottom: 1px solid var(--border); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        tr:hover td { background: var(--hover); }
        .vector-cell { font-family: var(--vscode-editor-font-family); font-size: 11px; color: var(--vscode-textPreformat-foreground); }
        .pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
        .page-info { color: var(--vscode-descriptionForeground); }
        .empty { text-align: center; padding: 40px; color: var(--vscode-descriptionForeground); }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${this.collection}</div>
        <div class="toolbar">
            <button class="btn" onclick="refresh()">↻ Refresh</button>
            <button class="btn" onclick="exportData()">⬇ Export JSON</button>
        </div>
    </div>

    <div class="filter-bar">
        <div class="filter-group">
            <label>Partition:</label>
            <select id="partition" onchange="applyFilter()">
                ${partitionOptions}
            </select>
        </div>
        <div class="filter-group" style="flex: 1;">
            <label>Filter:</label>
            <input type="text" id="filter" placeholder="e.g., id > 100 AND status == 'active'" value="${this.escapeHtml(this.currentFilter)}" onkeydown="if(event.key==='Enter')applyFilter()">
        </div>
        <button class="btn" onclick="applyFilter()">🔍 Query</button>
        <button class="btn" onclick="clearFilter()">✕ Clear</button>
    </div>

    <div class="stats">
        Showing ${rows.length > 0 ? offset + 1 : 0}–${offset + rows.length} of ${total.toLocaleString()} rows
        ${this.currentFilter ? ' (filtered)' : ''}
        ${this.currentPartition !== '_all' ? ` • Partition: ${this.currentPartition}` : ''}
    </div>

    ${rows.length === 0 ? '<div class="empty">No data found</div>' : `
    <div class="table-container">
        <table>
            <thead>
                <tr>${columns.map(c => `<th>${this.escapeHtml(c)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${columns.map(col => {
                            const val = row[col];
                            const isVector = Array.isArray(val) && val.length > 5;
                            const display = isVector 
                                ? `[${val.slice(0, 3).map((v: number) => typeof v === 'number' ? v.toFixed(4) : v).join(', ')}... (${val.length}D)]`
                                : this.escapeHtml(JSON.stringify(val));
                            return `<td class="${isVector ? 'vector-cell' : ''}" title="${this.escapeHtml(JSON.stringify(val))}">${display}</td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    `}

    <div class="pagination">
        <button class="btn" onclick="goPage(0)" ${currentPageNum === 1 ? 'disabled' : ''}>⏮ First</button>
        <button class="btn" onclick="goPage(${offset - limit})" ${currentPageNum === 1 ? 'disabled' : ''}>← Prev</button>
        <span class="page-info">Page ${currentPageNum} of ${totalPages}</span>
        <button class="btn" onclick="goPage(${offset + limit})" ${currentPageNum >= totalPages ? 'disabled' : ''}>Next →</button>
        <button class="btn" onclick="goPage(${(totalPages - 1) * limit})" ${currentPageNum >= totalPages ? 'disabled' : ''}>Last ⏭</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function goPage(offset) { 
            const filter = document.getElementById('filter').value;
            const partition = document.getElementById('partition').value;
            vscode.postMessage({ command: 'page', offset, limit: ${limit}, filter, partition }); 
        }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
        function exportData() { vscode.postMessage({ command: 'export' }); }
        function applyFilter() {
            const filter = document.getElementById('filter').value;
            const partition = document.getElementById('partition').value;
            vscode.postMessage({ command: 'query', filter, partition });
        }
        function clearFilter() {
            document.getElementById('filter').value = '';
            document.getElementById('partition').value = '_all';
            applyFilter();
        }
    </script>
</body>
</html>`;
    }

    private escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    private dispose(): void {
        const key = `${this.connectionId}:${this.database}:${this.collection}${this.initialPartition ? ':' + this.initialPartition : ''}`;
        DataViewerPanel.panels.delete(key);
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
