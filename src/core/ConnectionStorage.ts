import * as vscode from 'vscode';
import { ConnectionConfig } from '../types';

const STORAGE_KEY = 'dbvectorcode.connections';
const SECRET_PREFIX = 'dbvectorcode.pwd.';

export class ConnectionStorage {
    constructor(private context: vscode.ExtensionContext) {}

    async loadAll(): Promise<ConnectionConfig[]> {
        const stored = this.context.globalState.get<Omit<ConnectionConfig, 'password'>[]>(
            STORAGE_KEY, []
        );
        
        return Promise.all(stored.map(async conn => ({
            ...conn,
            password: await this.context.secrets.get(SECRET_PREFIX + conn.id),
        })));
    }

    async save(config: ConnectionConfig): Promise<void> {
        const all = await this.loadAll();
        const idx = all.findIndex(c => c.id === config.id);
        
        if (idx >= 0) {
            all[idx] = config;
        } else {
            all.push(config);
        }

        if (config.password) {
            await this.context.secrets.store(SECRET_PREFIX + config.id, config.password);
        }

        const toStore = all.map(({ password, ...rest }) => rest);
        await this.context.globalState.update(STORAGE_KEY, toStore);
    }

    async remove(id: string): Promise<void> {
        const all = await this.loadAll();
        const filtered = all.filter(c => c.id !== id);
        
        await this.context.secrets.delete(SECRET_PREFIX + id);
        
        const toStore = filtered.map(({ password, ...rest }) => rest);
        await this.context.globalState.update(STORAGE_KEY, toStore);
    }
}
