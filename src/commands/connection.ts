import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { MilvusTreeProvider } from '../views/TreeProvider';
import { ServerItem } from '../views/TreeItems';
import { ConnectionFormPanel } from '../panels/ConnectionFormPanel';

export function registerConnectionCommands(
    context: vscode.ExtensionContext,
    manager: ConnectionManager,
    tree: MilvusTreeProvider
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.addConnection', async () => {
            ConnectionFormPanel.show(context, async (config) => {
                await manager.addConnection(config);
                tree.setConnections(await manager.initialize());
                
                const connect = await vscode.window.showInformationMessage(
                    `Connection "${config.name}" added. Connect now?`,
                    'Connect', 'Later'
                );
                if (connect === 'Connect') {
                    try {
                        await manager.connect(config);
                    } catch (e) {
                        vscode.window.showErrorMessage(`Connection failed: ${e}`);
                    }
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.editConnection', async (item: ServerItem) => {
            ConnectionFormPanel.show(context, async (config) => {
                await manager.updateConnection(config);
                tree.setConnections(await manager.initialize());
                vscode.window.showInformationMessage(`Connection "${config.name}" updated`);
            }, item.config);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.connect', async (item: ServerItem) => {
            try {
                await manager.connect(item.config);
            } catch (e) {
                vscode.window.showErrorMessage(`Failed: ${e}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.disconnect', async (item: ServerItem) => {
            await manager.disconnect(item.config.id);
            vscode.window.showInformationMessage(`Disconnected from ${item.config.name}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.deleteConnection', async (item: ServerItem) => {
            const confirm = await vscode.window.showWarningMessage(
                `Delete connection "${item.config.name}"?`,
                { modal: true },
                'Delete'
            );
            if (confirm !== 'Delete') return;

            await manager.removeConnection(item.config.id);
            tree.setConnections(await manager.initialize());
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dbvector.refresh', () => tree.refresh())
    );
}
