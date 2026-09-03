# FlowCraft MCP Server

A **Model Context Protocol (MCP)** server that allows Claude, Cursor, or any AI assistant to programmatically create, inspect, edit, connect, and auto-layout visual diagrams in **FlowCraft**.

---

## Capabilities & Tools

The server provides **full CRUD** functionality across diagrams, nodes, and connections:

### 1. Diagram Management
- `list_diagrams`: List all diagrams with metadata (ID, title, category, node count, edge count, updatedAt).
- `get_diagram`: Retrieve full diagram details including all nodes, custom data properties, database columns, and edges.
- `create_diagram`: Create a new visual diagram (supports templates: `blank`, `microservices`, `checkout-flow`, `saas-er`).
- `update_diagram`: Update diagram title, description, category, tags, or grid settings.
- `duplicate_diagram`: Clone an existing diagram.
- `delete_diagram`: Permanently delete a diagram by ID.
- `tidy_diagram`: Automatically organize and align all nodes using the hierarchical layout engine.

### 2. Node Operations
- `add_node`: Add a node to any diagram. Supports:
  - **System Design Nodes** (`systemNode`): with cloud icons (server, database, cloud, globe, cpu, shield, layers, radio, smartphone, lock, cart, dollar), category, status pill, and theme colors.
  - **Flowchart Shapes** (`flowchartNode`): `process`, `decision` (diamond), `start-end` (pill), `input-output` (parallelogram).
  - **ER Database Tables** (`erTableNode`): with table name, header theme, and typed column definitions (`name`, `type`, `isPrimary`, `isForeign`, `isNullable`).
  - **Sticky Notes** (`stickyNode`): architecture notes and remarks in 5 color tones.
  - **Group Containers** (`groupNode`): VPC / Subnet boundaries.
- `update_node`: Modify position or any node properties (title, subtitle, status, colors, ER columns schema).
- `delete_node`: Remove a node and automatically clean up attached edges.

### 3. Edge / Connection Operations
- `add_edge`: Connect two nodes with labels (e.g. `HTTPS / REST`, `1 : N`, `Yes`), line curves (`smoothstep`, `bezier`, `straight`), animated pulse, and custom stroke colors.
- `update_edge`: Update edge label, style, animation, or stroke color.
- `delete_edge`: Remove a connection line.

### 4. High-Performance Batch Creation
- `batch_add_elements`: Insert multiple nodes and edges in a single atomic call with optional `autoLayout: true`. Perfect for having an AI generate entire microservice architectures or database schemas in a single prompt!

---

## Quick Setup

### 1. Build the Server
```bash
cd /mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server
pnpm install
pnpm run build
```

---

## Configuration for AI Clients

### A. Claude Desktop
Add this to your `claude_desktop_config.json` (`~/.config/Claude/claude_desktop_config.json` on Linux, `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "flowcraft": {
      "command": "node",
      "args": [
        "/mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server/dist/index.js"
      ],
      "env": {
        "FLOW_DATA_PATH": "/mnt/Data/Projects/diagrams_flow_builder/data/diagrams.json"
      }
    }
  }
}
```

### B. Cursor IDE
Add to `.cursor/mcp.json` or your Cursor MCP settings:

```json
{
  "mcpServers": {
    "flowcraft": {
      "command": "node",
      "args": [
        "/mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server/dist/index.js"
      ]
    }
  }
}
```

---

## Example AI Prompts

Once configured, you can prompt Claude or any AI with requests like:

- *"Show me all the diagrams currently saved in FlowCraft."*
- *"Create a new System Design diagram for an Uber-like ride hailing backend with Kafka, Redis, and WebSockets, and lay it out cleanly."*
- *"Add a Redis cache node connected to the Order Service in diagram `flow_123` with a smoothstep line."*
- *"Create an ER diagram for a hospital management database with patients, appointments, and doctors tables."*
- *"Tidy up the nodes in the checkout flow diagram."*
