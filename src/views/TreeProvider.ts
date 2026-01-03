import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { ConnectionConfig } from '../types';
import { ServerItem, DatabaseItem, CollectionItem, PartitionItem, MessageItem } from './TreeItems';

export class MilvusTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private configs: ConnectionConfig[] = [];

    constructor(private manager: ConnectionManager) {
        manager.onDidChange(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    setConnections(configs: ConnectionConfig[]): void {
        this.configs = configs;
        this.refresh();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            if (this.configs.length === 0) {
                return [new MessageItem('No connections', 'Click + to add')];
            }
            return this.configs.map(cfg => 
                new ServerItem(cfg, this.manager.isConnected(cfg.id))
            );
        }

        if (element instanceof ServerItem) {
            let client = this.manager.getClient(element.config.id);
            
            if (!client) {
                try {
                    await this.manager.connect(element.config);
                    client = this.manager.getClient(element.config.id);
                } catch (e) {
                    return [new MessageItem('Connection failed', String(e))];
                }
            }
            
            if (!client) {
                return [new MessageItem('Not connected')];
            }
            
            try {
                const dbs = await client.listDatabases();
                return dbs.map(name => new DatabaseItem(name, element.config));
            } catch (e) {
                return [new MessageItem('Error', String(e))];
            }
        }

        if (element instanceof DatabaseItem) {
            const client = this.manager.getClient(element.serverConfig.id);
            if (!client) return [];

            try {
                await client.useDatabase(element.name);
                const cols = await client.listCollections();
                
                if (cols.length === 0) {
                    return [new MessageItem('No collections', 'Right-click → Create')];
                }
                
                return cols.map(col => new CollectionItem(col, element));
            } catch (e) {
                return [new MessageItem('Error', String(e))];
            }
        }

        if (element instanceof CollectionItem) {
            const client = this.manager.getClient(element.database.serverConfig.id);
            if (!client) return [];

            try {
                await client.useDatabase(element.database.name);
                const partitions = await client.listPartitions(element.info.name);
                
                if (partitions.length === 0) {
                    return [new MessageItem('No partitions')];
                }
                
                return partitions.map(p => new PartitionItem(p, element));
            } catch (e) {
                return [new MessageItem('Error', String(e))];
            }
        }

        return [];
    }
}
