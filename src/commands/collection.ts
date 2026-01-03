import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { MilvusTreeProvider } from '../views/TreeProvider';
import { DatabaseItem, CollectionItem } from '../views/TreeItems';

export function registerCollectionCommands(
    context: vscode.ExtensionContext,
    manager: ConnectionManager,
    tree: MilvusTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.createCollection', async (item: DatabaseItem) => {
            const client = manager.getClient(item.serverConfig.id);
            if (!client) return;

            const name = await vscode.window.showInputBox({
                title: 'Create Collection (1/3)',
                prompt: 'Collection name',
                placeHolder: 'my_collection',
                validateInput: v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) 
                    ? null 
                    : 'Must start with letter/underscore, alphanumeric only',
            });
            if (!name) return;

            const dimStr = await vscode.window.showInputBox({
                title: 'Create Collection (2/3)',
                prompt: 'Vector dimension',
                value: '768',
                placeHolder: 'e.g., 384, 768, 1536',
                validateInput: v => {
                    const n = parseInt(v);
                    return n > 0 && n <= 32768 ? null : 'Must be 1–32768';
                },
            });
            if (!dimStr) return;

            const metric = await vscode.window.showQuickPick(
                [
                    { label: 'COSINE', description: 'Cosine similarity (recommended)' },
                    { label: 'L2', description: 'Euclidean distance' },
                    { label: 'IP', description: 'Inner product' },
                ],
                { title: 'Create Collection (3/3)', placeHolder: 'Select distance metric' }
            );
            if (!metric) return;

            try {
                await client.useDatabase(item.name);
                
                await client.createCollection({
                    name,
                    fields: [
                        { name: 'id', dataType: 'Int64', isPrimaryKey: true, autoId: true },
                        { name: 'vector', dataType: 'FloatVector', isPrimaryKey: false, autoId: false, dimension: parseInt(dimStr) },
                    ],
                    enableDynamicField: true,
                });

                await client.createIndex(name, 'vector', 'AUTOINDEX', metric.label);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Loading collection...',
                }, async () => {
                    await client.loadCollection(name);
                });

                vscode.window.showInformationMessage(`Collection "${name}" created and loaded`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.dropCollection', async (item: CollectionItem) => {
            const confirm = await vscode.window.showWarningMessage(
                `Delete collection "${item.info.name}"?\n\nThis will permanently delete all ${item.info.rowCount.toLocaleString()} vectors.`,
                { modal: true },
                'Delete'
            );
            if (confirm !== 'Delete') return;

            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            try {
                await client.useDatabase(item.database.name);
                await client.dropCollection(item.info.name);
                vscode.window.showInformationMessage(`Collection "${item.info.name}" deleted`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.loadCollection', async (item: CollectionItem) => {
            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Loading ${item.info.name}...`,
                }, async () => {
                    await client.useDatabase(item.database.name);
                    await client.loadCollection(item.info.name);
                });
                vscode.window.showInformationMessage(`Collection loaded`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.releaseCollection', async (item: CollectionItem) => {
            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            try {
                await client.useDatabase(item.database.name);
                await client.releaseCollection(item.info.name);
                vscode.window.showInformationMessage(`Collection released`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.describeCollection', async (item: CollectionItem) => {
            const client = manager.getClient(item.database.serverConfig.id);
            if (!client) return;

            try {
                await client.useDatabase(item.database.name);
                const desc = await client.describeCollection(item.info.name);
                
                const output = vscode.window.createOutputChannel('DBVectorCode');
                output.clear();
                output.appendLine(`=== Collection: ${item.info.name} ===\n`);
                output.appendLine(JSON.stringify(desc, null, 2));
                output.show();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );
}
