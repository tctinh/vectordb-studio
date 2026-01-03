import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { MilvusTreeProvider } from '../views/TreeProvider';
import { ServerItem, DatabaseItem } from '../views/TreeItems';

export function registerDatabaseCommands(
    context: vscode.ExtensionContext,
    manager: ConnectionManager,
    tree: MilvusTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.createDatabase', async (item: ServerItem) => {
            const client = manager.getClient(item.config.id);
            if (!client) return;

            const name = await vscode.window.showInputBox({
                title: 'Create Database',
                prompt: 'Database name',
                placeHolder: 'my_database',
                validateInput: v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) 
                    ? null 
                    : 'Must start with letter/underscore',
            });
            if (!name) return;

            try {
                await client.createDatabase(name);
                vscode.window.showInformationMessage(`Database "${name}" created`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.dropDatabase', async (item: DatabaseItem) => {
            if (item.name === 'default') {
                vscode.window.showWarningMessage('Cannot delete the default database');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `Delete database "${item.name}"?\n\nThis will delete ALL collections in this database.`,
                { modal: true },
                'Delete'
            );
            if (confirm !== 'Delete') return;

            const client = manager.getClient(item.serverConfig.id);
            if (!client) return;

            try {
                await client.dropDatabase(item.name);
                vscode.window.showInformationMessage(`Database "${item.name}" deleted`);
                tree.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );
}
