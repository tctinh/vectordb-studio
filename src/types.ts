export interface ConnectionConfig {
    id: string;
    name: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
}

export interface CollectionInfo {
    name: string;
    loaded: boolean;
    rowCount: number;
}

export interface FieldSchema {
    name: string;
    dataType: string;
    isPrimaryKey: boolean;
    autoId: boolean;
    dimension?: number;
    maxLength?: number;
}

export interface CollectionSchema {
    name: string;
    description?: string;
    fields: FieldSchema[];
    enableDynamicField: boolean;
}

export interface DataPage {
    rows: Record<string, unknown>[];
    total: number;
    offset: number;
    limit: number;
    columns: string[];
}
