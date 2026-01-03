import * as vscode from 'vscode';
import { ConnectionConfig, CollectionInfo } from '../types';

export class ServerItem extends vscode.TreeItem {
    constructor(
        public readonly config: ConnectionConfig,
        public readonly connected: boolean
    ) {
        super(config.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.description = `${config.host}:${config.port}`;
        this.contextValue = connected ? 'serverConnected' : 'serverDisconnected';
        this.iconPath = new vscode.ThemeIcon(
            connected ? 'vm-running' : 'vm-outline',
            new vscode.ThemeColor(connected ? 'testing.iconPassed' : 'testing.iconSkipped')
        );
        this.tooltip = new vscode.MarkdownString(
            `**${config.name}**\n\n` +
            `Host: \`${config.host}:${config.port}\`\n\n` +
            `Status: ${connected ? '🟢 Connected' : '🔴 Disconnected'}`
        );
    }
}

export class DatabaseItem extends vscode.TreeItem {
    constructor(
        public readonly name: string,
        public readonly serverConfig: ConnectionConfig
    ) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.contextValue = 'database';
        this.iconPath = new vscode.ThemeIcon('database');
        this.tooltip = `Database: ${name}`;
    }
}

export class CollectionItem extends vscode.TreeItem {
    constructor(
        public readonly info: CollectionInfo,
        public readonly database: DatabaseItem
    ) {
        super(info.name, vscode.TreeItemCollapsibleState.Collapsed);
        
        const loaded = info.loaded;
        this.description = `${info.rowCount.toLocaleString()} rows${loaded ? ' • loaded' : ''}`;
        this.contextValue = loaded ? 'collectionLoaded' : 'collectionUnloaded';
        this.iconPath = new vscode.ThemeIcon(
            'symbol-array',
            new vscode.ThemeColor(loaded ? 'charts.blue' : 'charts.yellow')
        );
        this.tooltip = new vscode.MarkdownString(
            `**${info.name}**\n\n` +
            `Rows: ${info.rowCount.toLocaleString()}\n\n` +
            `Status: ${loaded ? '🟢 Loaded' : '🟡 Not loaded'}`
        );
    }
}

export class PartitionItem extends vscode.TreeItem {
    constructor(
        public readonly partitionName: string,
        public readonly collection: CollectionItem
    ) {
        super(partitionName, vscode.TreeItemCollapsibleState.None);
        
        this.contextValue = 'partition';
        this.iconPath = new vscode.ThemeIcon('folder');
        this.description = 'partition';
        this.tooltip = `Partition: ${partitionName}`;
        this.command = {
            command: 'dbvector.viewPartitionData',
            title: 'View Partition Data',
            arguments: [this]
        };
    }
}

export class MessageItem extends vscode.TreeItem {
    constructor(message: string, description?: string) {
        super(message, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.iconPath = new vscode.ThemeIcon('info');
    }
}
