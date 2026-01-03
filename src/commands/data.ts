import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { DataViewerPanel } from '../panels/DataViewerPanel';
import { CollectionItem } from '../views/TreeItems';

export function registerDataCommands(
    context: vscode.ExtensionContext,
    manager: ConnectionManager
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.viewData', (item: CollectionItem) => {
            DataViewerPanel.show(
                context,
                manager,
                item.database.serverConfig.id,
                item.database.name,
                item.info.name
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.insertData', async (item: CollectionItem) => {
            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            const jsonInput = await vscode.window.showInputBox({
                title: 'Insert Data',
                prompt: 'Enter JSON array of objects to insert',
                placeHolder: '[{"vector": [0.1, 0.2, ...], "metadata": "value"}]',
            });
            if (!jsonInput) return;

            try {
                const data = JSON.parse(jsonInput);
                if (!Array.isArray(data)) {
                    throw new Error('Input must be a JSON array');
                }

                await client.useDatabase(item.database.name);
                const count = await client.insertData(item.info.name, data);
                vscode.window.showInformationMessage(`Inserted ${count} vectors`);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.deleteData', async (item: CollectionItem) => {
            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            const filter = await vscode.window.showInputBox({
                title: 'Delete Data',
                prompt: 'Enter filter expression',
                placeHolder: 'id in [1, 2, 3] or id > 100',
            });
            if (!filter) return;

            const confirm = await vscode.window.showWarningMessage(
                `Delete data matching: ${filter}?`,
                { modal: true },
                'Delete'
            );
            if (confirm !== 'Delete') return;

            try {
                await client.useDatabase(item.database.name);
                const count = await client.deleteByFilter(item.info.name, filter);
                vscode.window.showInformationMessage(`Deleted ${count} vectors`);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );
}
