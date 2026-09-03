#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getAllDiagrams, getDiagramById, createDiagram, updateDiagram, deleteDiagram, duplicateDiagram, addNodeToDiagram, updateNodeInDiagram, deleteNodeFromDiagram, addEdgeToDiagram, updateEdgeInDiagram, deleteEdgeFromDiagram, batchAddElements, getStorageFilePath, } from './storage.js';
import { tidyLayout } from './layout.js';
const server = new McpServer({
    name: 'flowcraft-mcp-server',
    version: '1.0.0',
});
// ==========================================
// 1. DIAGRAM CRUD TOOLS
// ==========================================
// Tool: list_diagrams
server.tool('list_diagrams', 'List all diagrams in FlowCraft with summary metadata (ID, title, category, node count, edge count, updatedAt).', {
    category: z.enum(['system-design', 'flowchart', 'er-diagram', 'general']).optional().describe('Filter by category'),
    search: z.string().optional().describe('Search query matching title, description or tags'),
}, async ({ category, search }) => {
    let diagrams = await getAllDiagrams();
    if (category) {
        diagrams = diagrams.filter((d) => d.category === category);
    }
    if (search && search.trim()) {
        const q = search.toLowerCase();
        diagrams = diagrams.filter((d) => d.title.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.tags.some((t) => t.toLowerCase().includes(q)));
    }
    const summary = diagrams.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        category: d.category,
        tags: d.tags,
        nodeCount: d.nodes.length,
        edgeCount: d.edges.length,
        updatedAt: d.updatedAt,
        url: `http://localhost:3000/flow/${d.id}`,
    }));
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    total: summary.length,
                    storageBackend: getStorageFilePath(),
                    diagrams: summary,
                }, null, 2),
            },
        ],
    };
});
// Tool: get_diagram
server.tool('get_diagram', 'Retrieve full diagram details by ID, including all nodes, custom data properties, ER database columns, and connection edges.', {
    diagramId: z.string().describe('The unique ID of the diagram (e.g. "template-microservices" or "flow_123456")'),
}, async ({ diagramId }) => {
    const diagram = await getDiagramById(diagramId);
    if (!diagram) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Diagram with ID "${diagramId}" was not found.` }],
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    id: diagram.id,
                    title: diagram.title,
                    description: diagram.description,
                    category: diagram.category,
                    tags: diagram.tags,
                    settings: diagram.settings,
                    nodes: diagram.nodes,
                    edges: diagram.edges,
                    createdAt: diagram.createdAt,
                    updatedAt: diagram.updatedAt,
                    editorUrl: `http://localhost:3000/flow/${diagram.id}`,
                }, null, 2),
            },
        ],
    };
});
// Tool: create_diagram
server.tool('create_diagram', 'Create a new visual diagram in FlowCraft with optional starter templates (blank, microservices, checkout-flow, saas-er).', {
    title: z.string().describe('Title / name of the diagram'),
    description: z.string().optional().describe('Short summary of what this diagram describes'),
    category: z.enum(['system-design', 'flowchart', 'er-diagram', 'general']).optional().default('system-design').describe('Category type'),
    tags: z.array(z.string()).optional().describe('Keywords or tags for categorization'),
    template: z.enum(['blank', 'microservices', 'checkout-flow', 'saas-er']).optional().default('blank').describe('Starter template to initialize nodes and edges with'),
    gridType: z.enum(['dots', 'lines', 'cross', 'none']).optional().default('dots').describe('Canvas grid pattern'),
    defaultEdgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().default('smoothstep').describe('Default connection curve'),
}, async (params) => {
    const created = await createDiagram(params);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Created diagram "${created.title}" successfully.`,
                    diagramId: created.id,
                    category: created.category,
                    nodeCount: created.nodes.length,
                    edgeCount: created.edges.length,
                    editorUrl: `http://localhost:3000/flow/${created.id}`,
                }, null, 2),
            },
        ],
    };
});
// Tool: update_diagram
server.tool('update_diagram', 'Update diagram metadata (title, description, category, tags, or canvas settings).', {
    diagramId: z.string().describe('The diagram ID to update'),
    title: z.string().optional().describe('New title for diagram'),
    description: z.string().optional().describe('New description'),
    category: z.enum(['system-design', 'flowchart', 'er-diagram', 'general']).optional().describe('New category'),
    tags: z.array(z.string()).optional().describe('New list of tags'),
    gridType: z.enum(['dots', 'lines', 'cross', 'none']).optional().describe('Canvas grid pattern'),
    defaultEdgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().describe('Default edge style'),
}, async ({ diagramId, title, description, category, tags, gridType, defaultEdgeType }) => {
    const existing = await getDiagramById(diagramId);
    if (!existing) {
        return { isError: true, content: [{ type: 'text', text: `Diagram "${diagramId}" not found.` }] };
    }
    const patch = {};
    if (title !== undefined)
        patch.title = title.trim();
    if (description !== undefined)
        patch.description = description.trim();
    if (category !== undefined)
        patch.category = category;
    if (tags !== undefined)
        patch.tags = tags;
    if (gridType || defaultEdgeType) {
        patch.settings = {
            ...existing.settings,
            ...(gridType ? { gridType } : {}),
            ...(defaultEdgeType ? { defaultEdgeType } : {}),
        };
    }
    const updated = await updateDiagram(diagramId, patch);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Diagram updated.', diagram: updated }, null, 2),
            },
        ],
    };
});
// Tool: duplicate_diagram
server.tool('duplicate_diagram', 'Duplicate / clone an existing diagram to a new copy.', {
    diagramId: z.string().describe('The diagram ID to clone'),
}, async ({ diagramId }) => {
    const cloned = await duplicateDiagram(diagramId);
    if (!cloned) {
        return { isError: true, content: [{ type: 'text', text: `Failed to clone diagram "${diagramId}".` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Duplicated diagram to "${cloned.title}"`,
                    newDiagramId: cloned.id,
                    editorUrl: `http://localhost:3000/flow/${cloned.id}`,
                }, null, 2),
            },
        ],
    };
});
// Tool: delete_diagram
server.tool('delete_diagram', 'Permanently delete a diagram by ID.', {
    diagramId: z.string().describe('The diagram ID to delete'),
}, async ({ diagramId }) => {
    const deleted = await deleteDiagram(diagramId);
    if (!deleted) {
        return { isError: true, content: [{ type: 'text', text: `Diagram "${diagramId}" not found or delete failed.` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: true, message: `Diagram "${diagramId}" deleted successfully.` }, null, 2),
            },
        ],
    };
});
// Tool: tidy_diagram
server.tool('tidy_diagram', 'Automatically organize and align all nodes in a diagram using the hierarchical layout algorithm.', {
    diagramId: z.string().describe('The diagram ID to arrange'),
}, async ({ diagramId }) => {
    const diagram = await getDiagramById(diagramId);
    if (!diagram) {
        return { isError: true, content: [{ type: 'text', text: `Diagram "${diagramId}" not found.` }] };
    }
    const arrangedNodes = tidyLayout(diagram.nodes, diagram.edges);
    const updated = await updateDiagram(diagramId, { nodes: arrangedNodes });
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Auto-arranged ${arrangedNodes.length} nodes in diagram "${diagram.title}".`,
                    nodes: arrangedNodes.map((n) => ({ id: n.id, title: n.data.title || n.data.label || n.data.tableName, position: n.position })),
                }, null, 2),
            },
        ],
    };
});
// ==========================================
// 2. NODE CRUD TOOLS
// ==========================================
// Tool: add_node
server.tool('add_node', 'Add a new node to a diagram. Supports system nodes, flowchart shapes, ER table nodes, sticky notes, and container groups.', {
    diagramId: z.string().describe('Diagram ID to add node into'),
    nodeId: z.string().optional().describe('Custom ID for node. If omitted, a unique ID is auto-generated.'),
    type: z.enum(['systemNode', 'flowchartNode', 'erTableNode', 'groupNode', 'stickyNode']).describe('Type of node'),
    position: z.object({ x: z.number(), y: z.number() }).optional().describe('Canvas position. If omitted, positioned automatically.'),
    // System Node Props
    title: z.string().optional().describe('[systemNode] Primary title, e.g. "Order Service" or "Postgres DB"'),
    subtitle: z.string().optional().describe('[systemNode] Secondary tech info, e.g. "Go / gRPC" or "Port 5432"'),
    icon: z.string().optional().default('server').describe('[systemNode] Icon name: server, database, cloud, globe, cpu, shield, layers, radio, smartphone, terminal, arrow-left-right, lock, cart, dollar'),
    category: z.string().optional().describe('[systemNode] Category badge: Compute, Database, Storage, Security, Queue, Client, Network'),
    status: z.string().optional().describe('[systemNode] Status pill: "Active", "Healthy", "Port 8080"'),
    themeColor: z.enum(['blue', 'indigo', 'emerald', 'amber', 'rose', 'purple', 'cyan', 'slate']).optional().default('blue').describe('Color theme'),
    // Flowchart Node Props
    label: z.string().optional().describe('[flowchartNode] Step text label'),
    description: z.string().optional().describe('[flowchartNode] Description or step details'),
    shape: z.enum(['start-end', 'process', 'decision', 'input-output']).optional().default('process').describe('[flowchartNode] Geometric shape'),
    // ER Table Node Props
    tableName: z.string().optional().describe('[erTableNode] Name of SQL table, e.g. "users", "orders"'),
    headerColor: z.enum(['blue', 'indigo', 'emerald', 'amber', 'rose', 'purple', 'slate']).optional().default('blue').describe('[erTableNode] Header color'),
    columns: z.array(z.object({
        name: z.string().describe('Column name, e.g. "id", "user_id"'),
        type: z.string().describe('Data type, e.g. "UUID", "VARCHAR(255)", "INT"'),
        isPrimary: z.boolean().optional().describe('Whether this column is a Primary Key'),
        isForeign: z.boolean().optional().describe('Whether this column is a Foreign Key'),
        isNullable: z.boolean().optional().describe('Whether column can be null'),
    })).optional().describe('[erTableNode] Array of columns'),
    // Sticky Node Props
    noteTitle: z.string().optional().describe('[stickyNode] Title of sticky note'),
    noteText: z.string().optional().describe('[stickyNode] Note content or architecture remarks'),
    noteColor: z.enum(['yellow', 'blue', 'green', 'pink', 'purple']).optional().default('yellow').describe('[stickyNode] Color'),
    // Group Node Props
    groupLabel: z.string().optional().describe('[groupNode] Container label, e.g. "AWS VPC 10.0.0.0/16"'),
    stylePreset: z.enum(['slate', 'blue', 'emerald', 'amber', 'purple', 'rose']).optional().default('slate').describe('[groupNode] Border style preset'),
}, async (params) => {
    let nodeData = {};
    if (params.type === 'systemNode') {
        nodeData = {
            title: params.title || 'New Component',
            subtitle: params.subtitle || '',
            icon: params.icon || 'server',
            category: params.category || 'Compute',
            status: params.status || 'Active',
            themeColor: params.themeColor || 'blue',
        };
    }
    else if (params.type === 'flowchartNode') {
        nodeData = {
            label: params.label || 'Step',
            description: params.description || '',
            shape: params.shape || 'process',
            themeColor: params.themeColor || 'slate',
        };
    }
    else if (params.type === 'erTableNode') {
        nodeData = {
            tableName: params.tableName || 'new_table',
            headerColor: params.headerColor || 'blue',
            columns: params.columns && params.columns.length > 0
                ? params.columns.map((c, i) => ({ id: `col_${Date.now()}_${i}`, ...c }))
                : [
                    { id: 'c1', name: 'id', type: 'UUID', isPrimary: true },
                    { id: 'c2', name: 'created_at', type: 'TIMESTAMPTZ' },
                ],
        };
    }
    else if (params.type === 'stickyNode') {
        nodeData = {
            title: params.noteTitle || 'Note',
            text: params.noteText || '',
            color: params.noteColor || 'yellow',
        };
    }
    else if (params.type === 'groupNode') {
        nodeData = {
            label: params.groupLabel || 'Container Group',
            stylePreset: params.stylePreset || 'slate',
        };
    }
    const newNode = await addNodeToDiagram(params.diagramId, {
        id: params.nodeId,
        type: params.type,
        position: params.position,
        data: nodeData,
    });
    if (!newNode) {
        return { isError: true, content: [{ type: 'text', text: `Diagram "${params.diagramId}" not found.` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Added node "${newNode.id}" (${params.type}) to diagram "${params.diagramId}".`,
                    node: newNode,
                }, null, 2),
            },
        ],
    };
});
// Tool: update_node
server.tool('update_node', "Update an existing node's data or position (change title, status, ER columns, color, or move coordinates).", {
    diagramId: z.string().describe('The diagram ID'),
    nodeId: z.string().describe('The node ID to update'),
    position: z.object({ x: z.number(), y: z.number() }).optional().describe('New position on canvas'),
    data: z.record(z.any()).optional().describe('Key-value pairs to merge into node data (e.g. { title: "New Title", status: "Port 9090", themeColor: "emerald" })'),
}, async ({ diagramId, nodeId, position, data }) => {
    const updated = await updateNodeInDiagram(diagramId, nodeId, { position, data });
    if (!updated) {
        return {
            isError: true,
            content: [{ type: 'text', text: `Node "${nodeId}" in diagram "${diagramId}" not found.` }],
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: true, message: `Updated node "${nodeId}".`, node: updated }, null, 2),
            },
        ],
    };
});
// Tool: delete_node
server.tool('delete_node', 'Delete a node from a diagram (automatically deletes any edges connected to it).', {
    diagramId: z.string().describe('The diagram ID'),
    nodeId: z.string().describe('The node ID to delete'),
}, async ({ diagramId, nodeId }) => {
    const deleted = await deleteNodeFromDiagram(diagramId, nodeId);
    if (!deleted) {
        return { isError: true, content: [{ type: 'text', text: `Node "${nodeId}" not found in diagram "${diagramId}".` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: true, message: `Node "${nodeId}" and connected edges removed.` }, null, 2),
            },
        ],
    };
});
// ==========================================
// 3. EDGE CRUD TOOLS
// ==========================================
// Tool: add_edge
server.tool('add_edge', 'Connect two nodes in a diagram with a directional connection edge.', {
    diagramId: z.string().describe('The diagram ID'),
    source: z.string().describe('Source node ID'),
    target: z.string().describe('Target node ID'),
    edgeId: z.string().optional().describe('Optional custom ID for edge'),
    label: z.string().optional().describe('Edge text label, e.g. "HTTPS / REST", "1 : N", "Yes", "No"'),
    sourceHandle: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Handle on source node to originate connection'),
    targetHandle: z.enum(['top', 'right', 'bottom', 'left']).optional().describe('Handle on target node to terminate connection'),
    edgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().default('smoothstep').describe('Line curve style'),
    animated: z.boolean().optional().default(false).describe('Whether to animate a moving dashed pulse'),
    strokeColor: z.string().optional().default('#64748b').describe('Line stroke color hex (e.g. #2563eb, #10b981)'),
    strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional().default('solid').describe('Line dash pattern'),
}, async (params) => {
    try {
        const edge = await addEdgeToDiagram(params.diagramId, params);
        if (!edge) {
            return { isError: true, content: [{ type: 'text', text: `Diagram "${params.diagramId}" not found.` }] };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: true, message: `Connected "${params.source}" -> "${params.target}".`, edge }, null, 2),
                },
            ],
        };
    }
    catch (err) {
        return { isError: true, content: [{ type: 'text', text: err.message || 'Failed to add edge' }] };
    }
});
// Tool: update_edge
server.tool('update_edge', "Update an existing edge's label, curve style, animation, or stroke color.", {
    diagramId: z.string().describe('The diagram ID'),
    edgeId: z.string().describe('The edge ID to update'),
    label: z.string().optional().describe('New edge label'),
    edgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().describe('Line curve style'),
    animated: z.boolean().optional().describe('Toggle animation pulse'),
    strokeColor: z.string().optional().describe('Line stroke hex color'),
    strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional().describe('Line stroke pattern'),
}, async ({ diagramId, edgeId, ...patch }) => {
    const updated = await updateEdgeInDiagram(diagramId, edgeId, patch);
    if (!updated) {
        return { isError: true, content: [{ type: 'text', text: `Edge "${edgeId}" not found in diagram "${diagramId}".` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: true, message: `Edge "${edgeId}" updated.`, edge: updated }, null, 2),
            },
        ],
    };
});
// Tool: delete_edge
server.tool('delete_edge', 'Delete a connection edge between nodes.', {
    diagramId: z.string().describe('The diagram ID'),
    edgeId: z.string().describe('The edge ID to delete'),
}, async ({ diagramId, edgeId }) => {
    const deleted = await deleteEdgeFromDiagram(diagramId, edgeId);
    if (!deleted) {
        return { isError: true, content: [{ type: 'text', text: `Edge "${edgeId}" not found in diagram "${diagramId}".` }] };
    }
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ success: true, message: `Edge "${edgeId}" deleted.` }, null, 2),
            },
        ],
    };
});
// ==========================================
// 4. BATCH CREATION TOOL
// ==========================================
// Tool: batch_add_elements
server.tool('batch_add_elements', 'Add multiple nodes and edges to a diagram in a single atomic call. Best for generating entire systems, workflows, or architectures.', {
    diagramId: z.string().describe('Target diagram ID'),
    nodes: z.array(z.object({
        id: z.string().describe('Unique node ID (e.g. "api-gw", "db-main")'),
        type: z.enum(['systemNode', 'flowchartNode', 'erTableNode', 'groupNode', 'stickyNode']).describe('Node type'),
        position: z.object({ x: z.number(), y: z.number() }).optional().describe('Canvas coordinates'),
        data: z.record(z.any()).describe('Node data matching the node type (title, subtitle, icon, themeColor, tableName, columns, label, shape, etc.)'),
    })).describe('List of nodes to insert'),
    edges: z.array(z.object({
        id: z.string().optional().describe('Edge ID (optional)'),
        source: z.string().describe('Source node ID'),
        target: z.string().describe('Target node ID'),
        label: z.string().optional().describe('Connection label'),
        edgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().default('smoothstep'),
        animated: z.boolean().optional().default(false),
        strokeColor: z.string().optional().default('#64748b'),
    })).optional().default([]).describe('List of edges connecting the nodes'),
    autoLayout: z.boolean().optional().default(true).describe('If true, automatically computes clean non-overlapping coordinates for all nodes'),
}, async ({ diagramId, nodes, edges, autoLayout }) => {
    const diagram = await getDiagramById(diagramId);
    if (!diagram) {
        return { isError: true, content: [{ type: 'text', text: `Diagram "${diagramId}" not found.` }] };
    }
    let preparedNodes = nodes.map((n, i) => ({
        id: n.id,
        type: n.type,
        position: n.position || { x: 100 + (i % 4) * 260, y: 100 + Math.floor(i / 4) * 160 },
        data: n.data,
    }));
    const preparedEdges = (edges || []).map((e, i) => ({
        id: e.id || `e_${Date.now()}_${i}`,
        source: e.source,
        target: e.target,
        type: 'customEdge',
        data: {
            label: e.label || '',
            edgeType: e.edgeType || 'smoothstep',
            animated: e.animated ?? false,
            strokeColor: e.strokeColor || '#64748b',
        },
    }));
    if (autoLayout) {
        const allNodes = [...diagram.nodes, ...preparedNodes];
        const allEdges = [...diagram.edges, ...preparedEdges];
        const tidied = tidyLayout(allNodes, allEdges);
        await updateDiagram(diagramId, { nodes: tidied, edges: allEdges });
    }
    else {
        await batchAddElements(diagramId, preparedNodes, preparedEdges);
    }
    const updatedDiagram = await getDiagramById(diagramId);
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Batch added ${nodes.length} nodes and ${(edges || []).length} edges to diagram "${diagram.title}".`,
                    totalNodes: updatedDiagram?.nodes.length,
                    totalEdges: updatedDiagram?.edges.length,
                    editorUrl: `http://localhost:3000/flow/${diagramId}`,
                }, null, 2),
            },
        ],
    };
});
// Start server on stdio transport
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[FlowCraft MCP Server] Running and ready on stdio transport.');
    console.error(`[FlowCraft MCP Server] Diagrams data store: ${getStorageFilePath()}`);
}
run().catch((err) => {
    console.error('[FlowCraft MCP Server] Fatal error starting server:', err);
    process.exit(1);
});
