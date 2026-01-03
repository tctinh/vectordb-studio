import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { MilvusTreeProvider } from '../views/TreeProvider';
import { CollectionItem, PartitionItem } from '../views/TreeItems';
import { DataViewerPanel } from '../panels/DataViewerPanel';

export function registerPartitionCommands(
    context: vscode.ExtensionContext,
    manager: ConnectionManager,
    tree: MilvusTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.createPartition', async (item: CollectionItem) => {
            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            const name = await vscode.window.showInputBox({
                title: 'Create Partition',
                prompt: 'Partition name',
                placeHolder: 'my_partition',
                validateInput: v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) ? null : 'Invalid name'
            });
            if (!name) return;

            try {
                await client.useDatabase(item.database.name);
                await client.createPartition(item.info.name, name);
                vscode.window.showInformationMessage(`Partition "${name}" created`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.dropPartition', async (item: PartitionItem) => {
            if (item.partitionName === '_default') {
                vscode.window.showWarningMessage('Cannot delete the default partition');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete partition "${item.partitionName}"?\n\nAll data in this partition will be permanently deleted.`,
                { modal: true },
                'Delete'
            );
            if (confirm !== 'Delete') return;

            const client = manager.getClient(item.collection.database.serverConfig.id);
            if (!client) return;

            try {
                await client.useDatabase(item.collection.database.name);
                await client.dropPartition(item.collection.info.name, item.partitionName);
                vscode.window.showInformationMessage(`Partition "${item.partitionName}" deleted`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.viewPartitionData', async (item: PartitionItem) => {
            DataViewerPanel.show(
                context,
                manager,
                item.collection.database.serverConfig.id,
                item.collection.database.name,
                item.collection.info.name,
                item.partitionName
            );
        })
    );
}
