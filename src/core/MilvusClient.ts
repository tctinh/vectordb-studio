import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import { ConnectionConfig, CollectionInfo, CollectionSchema, DataPage } from '../types';

export class MilvusWrapper {
    private client: MilvusClient | null = null;
    private currentDatabase: string = 'default';

    constructor(private config: ConnectionConfig) {}

    async connect(): Promise<void> {
        this.client = new MilvusClient({
            address: `${this.config.host}:${this.config.port}`,
            username: this.config.username,
            password: this.config.password,
            timeout: 10000,
        });
        await this.client.checkHealth();
    }

    async disconnect(): Promise<void> {
        this.client = null;
    }

    get isConnected(): boolean {
        return this.client !== null;
    }

    private get sdk(): MilvusClient {
        if (!this.client) throw new Error('Not connected');
        return this.client;
    }

    async listDatabases(): Promise<string[]> {
        const res = await this.sdk.listDatabases();
        return res.db_names || ['default'];
    }

    async createDatabase(name: string): Promise<void> {
        await this.sdk.createDatabase({ db_name: name });
    }

    async dropDatabase(name: string): Promise<void> {
        await this.sdk.dropDatabase({ db_name: name });
    }

    async useDatabase(name: string): Promise<void> {
        await this.sdk.useDatabase({ db_name: name });
        this.currentDatabase = name;
    }

    async listCollections(): Promise<CollectionInfo[]> {
        const res = await this.sdk.listCollections();
        const collections: CollectionInfo[] = [];
        
        for (const col of res.data || []) {
            const stats = await this.sdk.getCollectionStatistics({ 
                collection_name: col.name 
            });
            const loadState = await this.sdk.getLoadState({ 
                collection_name: col.name 
            });
            
            const rowCountValue = stats.stats?.find(s => s.key === 'row_count')?.value;
            const rowCount = parseInt(String(rowCountValue ?? '0'));
            
            collections.push({
                name: col.name,
                loaded: loadState.state === 'LoadStateLoaded',
                rowCount,
            });
        }
        return collections;
    }

    async createCollection(schema: CollectionSchema): Promise<void> {
        const fields = schema.fields.map(f => ({
            name: f.name,
            data_type: DataType[f.dataType as keyof typeof DataType],
            is_primary_key: f.isPrimaryKey,
            autoID: f.autoId,
            dim: f.dimension,
            max_length: f.maxLength,
        }));

        await this.sdk.createCollection({
            collection_name: schema.name,
            description: schema.description,
            fields,
            enable_dynamic_field: schema.enableDynamicField,
        });
    }

    async describeCollection(name: string): Promise<unknown> {
        return await this.sdk.describeCollection({ collection_name: name });
    }

    async dropCollection(name: string): Promise<void> {
        try { await this.sdk.releaseCollection({ collection_name: name }); } catch {}
        await this.sdk.dropCollection({ collection_name: name });
    }

    async loadCollection(name: string): Promise<void> {
        await this.sdk.loadCollectionSync({ collection_name: name });
    }

    async releaseCollection(name: string): Promise<void> {
        await this.sdk.releaseCollection({ collection_name: name });
    }

    async queryData(
        collection: string, 
        offset: number = 0, 
        limit: number = 50,
        filter: string = ''
    ): Promise<DataPage> {
        const stats = await this.sdk.getCollectionStatistics({ 
            collection_name: collection 
        });
        const totalValue = stats.stats?.find(s => s.key === 'row_count')?.value;
        const total = parseInt(String(totalValue ?? '0'));

        const res = await this.sdk.query({
            collection_name: collection,
            filter: filter || '',
            output_fields: ['*'],
            limit,
            offset,
        });

        const rows = res.data || [];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return { rows, total, offset, limit, columns };
    }

    async insertData(collection: string, data: Record<string, unknown>[]): Promise<number> {
        const res = await this.sdk.insert({
            collection_name: collection,
            data: data as never,
        });
        return res.succ_index?.length || 0;
    }

    async deleteByFilter(collection: string, filter: string): Promise<number> {
        const res = await this.sdk.delete({
            collection_name: collection,
            filter,
        });
        return Number(res.delete_cnt) || 0;
    }

    async createIndex(
        collection: string,
        field: string,
        indexType: string = 'AUTOINDEX',
        metricType: string = 'COSINE'
    ): Promise<void> {
        await this.sdk.createIndex({
            collection_name: collection,
            field_name: field,
            index_type: indexType as never,
            metric_type: metricType as never,
        });
    }

    async listPartitions(collection: string): Promise<string[]> {
        const res = await this.sdk.showPartitions({ collection_name: collection });
        return res.partition_names || ['_default'];
    }

    async createPartition(collection: string, partitionName: string): Promise<void> {
        await this.sdk.createPartition({
            collection_name: collection,
            partition_name: partitionName,
        });
    }

    async dropPartition(collection: string, partitionName: string): Promise<void> {
        await this.sdk.dropPartition({
            collection_name: collection,
            partition_name: partitionName,
        });
    }

    async queryDataWithPartition(
        collection: string,
        offset: number = 0,
        limit: number = 50,
        filter: string = '',
        partitionNames?: string[]
    ): Promise<DataPage> {
        const baseParams: Record<string, unknown> = {
            collection_name: collection,
            filter: filter || '',
        };

        if (partitionNames && partitionNames.length > 0 && !partitionNames.includes('_all')) {
            baseParams.partition_names = partitionNames;
        }

        const countRes = await this.sdk.query({
            ...baseParams,
            output_fields: ['count(*)'],
        } as never);
        const total = Number(countRes.data?.[0]?.['count(*)'] ?? 0);

        const res = await this.sdk.query({
            ...baseParams,
            output_fields: ['*'],
            limit,
            offset,
        } as never);

        const rows = res.data || [];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        return { rows, total, offset, limit, columns };
    }
}
