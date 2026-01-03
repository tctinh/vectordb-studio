import * as vscode from 'vscode';
import { ConnectionManager } from '../core/ConnectionManager';
import { MilvusTreeProvider } from '../views/TreeProvider';
import { registerConnectionCommands } from './connection';
import { registerDatabaseCommands } from './database';
import { registerCollectionCommands } from './collection';
import { registerDataCommands } from './data';
import { registerPartitionCommands } from './partition';

export function registerAllCommands(
    context: vscode.ExtensionContext,
    manager: ConnectionManager,
    tree: MilvusTreeProvider
): void {
    registerConnectionCommands(context, manager, tree);
    registerDatabaseCommands(context, manager, tree);
    registerCollectionCommands(context, manager, tree);
    registerDataCommands(context, manager);
    registerPartitionCommands(context, manager, tree);
}
