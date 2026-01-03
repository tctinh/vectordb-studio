# VectorDB Studio

Manage Milvus vector databases directly in VS Code. Create, browse, and query collections with an intuitive interface.

## Features

- **Connection Management** - Add, edit, and manage multiple Milvus connections
- **Database Operations** - Create and drop databases
- **Collection Management** - Create, load, release, and drop collections
- **Data Operations** - View, insert, and delete vector data
- **Partition Support** - Create and manage partitions
- **Schema Viewer** - Inspect collection schemas and field details

## Installation

1. Install from VS Code Marketplace
2. Click the VectorDB Studio icon in the Activity Bar
3. Add a connection to your Milvus instance

## Usage

### Adding a Connection

1. Click the `+` button in the VectorDB Studio panel
2. Enter your Milvus connection details:
   - Host (e.g., `localhost`)
   - Port (default: `19530`)
   - Username/Password (if authentication enabled)

### Managing Collections

- **View Data** - Right-click a collection and select "View Data"
- **Insert Data** - Right-click a collection and select "Insert Data"
- **Load/Release** - Manage collection memory state

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `vectordb-studio.pageSize` | Default page size for data viewing | 50 |
| `vectordb-studio.connectionTimeout` | Connection timeout in milliseconds | 10000 |

## Roadmap

- [ ] Pinecone support
- [ ] Qdrant support
- [ ] ChromaDB support
- [ ] Vector search UI
- [ ] Data export/import

## Requirements

- Milvus 2.x instance
- VS Code 1.85.0 or higher

## License

MIT with Commons Clause - Free for personal and non-commercial use. See [LICENSE](LICENSE) for details.
