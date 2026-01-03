import * as vscode from 'vscode';
import { MilvusWrapper } from './MilvusClient';
import { ConnectionStorage } from './ConnectionStorage';
import { ConnectionConfig } from '../types';

export class ConnectionManager {
    private connections = new Map<string, MilvusWrapper>();
    private storage: ConnectionStorage;
    
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;

    constructor(context: vscode.ExtensionContext) {
        this.storage = new ConnectionStorage(context);
    }

    async initialize(): Promise<ConnectionConfig[]> {
        return await this.storage.loadAll();
    }

    async addConnection(config: ConnectionConfig): Promise<void> {
        await this.storage.save(config);
        this._onDidChange.fire();
    }

    async updateConnection(config: ConnectionConfig): Promise<void> {
        await this.storage.save(config);
        this._onDidChange.fire();
    }

    async removeConnection(id: string): Promise<void> {
        await this.disconnect(id);
        await this.storage.remove(id);
        this._onDidChange.fire();
    }

    async connect(config: ConnectionConfig): Promise<void> {
        const wrapper = new MilvusWrapper(config);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Connecting to ${config.name}...`,
            cancellable: false,
        }, async () => {
            await wrapper.connect();
        });

        this.connections.set(config.id, wrapper);
        this._onDidChange.fire();
        vscode.window.showInformationMessage(`Connected to ${config.name}`);
    }

    async disconnect(id: string): Promise<void> {
        const wrapper = this.connections.get(id);
        if (wrapper) {
            await wrapper.disconnect();
            this.connections.delete(id);
            this._onDidChange.fire();
        }
    }

    getClient(id: string): MilvusWrapper | undefined {
        return this.connections.get(id);
    }

    isConnected(id: string): boolean {
        return this.connections.has(id);
    }

    async cleanup(): Promise<void> {
        for (const [id] of this.connections) {
            await this.disconnect(id);
        }
    }
}
