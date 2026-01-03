import * as vscode from 'vscode';
import { ConnectionManager } from './core/ConnectionManager';
import { MilvusTreeProvider } from './views/TreeProvider';
import { registerAllCommands } from './commands';

let connectionManager: ConnectionManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('DBVectorCode is now active!');

    connectionManager = new ConnectionManager(context);
    const treeProvider = new MilvusTreeProvider(connectionManager);

    const treeView = vscode.window.createTreeView('dbvectorExplorer', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });
    context.subscriptions.push(treeView);

    const configs = await connectionManager.initialize();
    treeProvider.setConnections(configs);

    registerAllCommands(context, connectionManager, treeProvider);

    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = '$(database) Milvus';
    statusBar.tooltip = 'DBVectorCode - Milvus Manager';
    statusBar.command = 'dbvector.addConnection';
    statusBar.show();
    context.subscriptions.push(statusBar);
}

export function deactivate() {
    connectionManager?.cleanup();
}
