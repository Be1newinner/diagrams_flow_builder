import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth';
import {
  getServerDiagrams,
  getServerDiagram,
  saveServerDiagram,
  deleteServerDiagram,
} from '@/lib/serverStorage';
import { tidyLayout } from '@/lib/layout';
import { Diagram, DiagramCategory, Node, Edge } from '@/types/diagram';

const LIVE_APP_URL = 'https://diagrams-flow-builder.vercel.app';
const getEditorUrl = (id: string) => `${LIVE_APP_URL}/flow/${id}`;

// Auth info the token verifier attaches; carried through to every tool call.
interface McpAuthExtra {
  userId: string;
  email: string;
  name: string;
  [key: string]: unknown;
}

function requireUserId(extra: any): string {
  const userId = (extra?.authInfo?.extra as McpAuthExtra | undefined)?.userId;
  if (!userId) {
    throw new Error('Unauthorized: no valid MCP token on this request.');
  }
  return userId;
}

function errorResult(message: string) {
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] };
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

const TEMPLATE_PRESETS: Record<string, { nodes: Node[]; edges: Edge[] }> = {
  microservices: {
    nodes: [
      { id: 'node-client', type: 'systemNode', position: { x: 50, y: 150 }, data: { title: 'Web App', subtitle: 'Next.js Client', icon: 'smartphone', category: 'Client', themeColor: 'blue' } },
      { id: 'node-gw', type: 'systemNode', position: { x: 320, y: 150 }, data: { title: 'API Gateway', subtitle: 'Envoy / Kong', icon: 'arrow-left-right', category: 'Network', themeColor: 'indigo' } },
      { id: 'node-svc', type: 'systemNode', position: { x: 600, y: 150 }, data: { title: 'Core Service', subtitle: 'Go Microservice', icon: 'server', category: 'Compute', themeColor: 'emerald' } },
      { id: 'node-db', type: 'systemNode', position: { x: 880, y: 150 }, data: { title: 'PostgreSQL DB', subtitle: 'RDS Primary', icon: 'database', category: 'Database', themeColor: 'blue' } },
    ],
    edges: [
      { id: 'e1', source: 'node-client', target: 'node-gw', type: 'customEdge', data: { label: 'HTTPS / JSON', edgeType: 'smoothstep' } },
      { id: 'e2', source: 'node-gw', target: 'node-svc', type: 'customEdge', data: { label: '/api/v1', edgeType: 'smoothstep' } },
      { id: 'e3', source: 'node-svc', target: 'node-db', type: 'customEdge', data: { label: 'SQL queries', edgeType: 'smoothstep' } },
    ],
  },
  'checkout-flow': {
    nodes: [
      { id: 'fc-1', type: 'flowchartNode', position: { x: 250, y: 40 }, data: { label: 'Start Checkout', shape: 'start-end', themeColor: 'blue' } },
      { id: 'fc-2', type: 'flowchartNode', position: { x: 250, y: 160 }, data: { label: 'Validate Stock', shape: 'process', themeColor: 'slate' } },
      { id: 'fc-3', type: 'flowchartNode', position: { x: 250, y: 280 }, data: { label: 'Charge Payment', shape: 'process', themeColor: 'emerald' } },
      { id: 'fc-4', type: 'flowchartNode', position: { x: 250, y: 400 }, data: { label: 'Order Complete', shape: 'start-end', themeColor: 'emerald' } },
    ],
    edges: [
      { id: 'e1', source: 'fc-1', target: 'fc-2', type: 'customEdge', data: { label: '', edgeType: 'smoothstep' } },
      { id: 'e2', source: 'fc-2', target: 'fc-3', type: 'customEdge', data: { label: 'In Stock', edgeType: 'smoothstep' } },
      { id: 'e3', source: 'fc-3', target: 'fc-4', type: 'customEdge', data: { label: 'Paid 200 OK', edgeType: 'smoothstep' } },
    ],
  },
  'saas-er': {
    nodes: [
      { id: 'table-users', type: 'erTableNode', position: { x: 100, y: 100 }, data: { tableName: 'users', headerColor: 'blue', columns: [{ id: 'c1', name: 'id', type: 'UUID', isPrimary: true }, { id: 'c2', name: 'email', type: 'VARCHAR(255)' }, { id: 'c3', name: 'created_at', type: 'TIMESTAMPTZ' }] } },
      { id: 'table-teams', type: 'erTableNode', position: { x: 450, y: 100 }, data: { tableName: 'teams', headerColor: 'indigo', columns: [{ id: 't1', name: 'id', type: 'UUID', isPrimary: true }, { id: 't2', name: 'name', type: 'VARCHAR(100)' }, { id: 't3', name: 'owner_id', type: 'UUID', isForeign: true }] } },
    ],
    edges: [{ id: 'e1', source: 'table-users', target: 'table-teams', type: 'customEdge', data: { label: '1 : N (Owns)', edgeType: 'smoothstep' } }],
  },
};

const handler = createMcpHandler(
  (server) => {
    // ==========================================
    // 1. DIAGRAM CRUD
    // ==========================================

    server.tool(
      'list_diagrams',
      'List all diagrams you own or have access to, with summary metadata (ID, title, category, node count, edge count, updatedAt, live URL).',
      {
        category: z.enum(['system-design', 'flowchart', 'er-diagram', 'general']).optional().describe('Filter by category'),
        search: z.string().optional().describe('Search query matching title, description or tags'),
      },
      async ({ category, search }, extra) => {
        const userId = requireUserId(extra);
        let diagrams = await getServerDiagrams(userId);
        if (category) diagrams = diagrams.filter((d) => d.category === category);
        if (search && search.trim()) {
          const q = search.toLowerCase();
          diagrams = diagrams.filter(
            (d) =>
              d.title.toLowerCase().includes(q) ||
              d.description.toLowerCase().includes(q) ||
              d.tags.some((t) => t.toLowerCase().includes(q))
          );
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
          url: getEditorUrl(d.id),
        }));
        return jsonResult({ total: summary.length, appUrl: LIVE_APP_URL, diagrams: summary });
      }
    );

    server.tool(
      'get_diagram',
      'Retrieve full diagram details by ID, including all nodes, custom data properties, ER database columns, and connection edges.',
      { diagramId: z.string().describe('The unique ID of the diagram (e.g. "template-microservices" or "flow_123456")') },
      async ({ diagramId }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" was not found or you don't have access to it.`);
        return jsonResult({ ...diagram, editorUrl: getEditorUrl(diagram.id) });
      }
    );

    server.tool(
      'create_diagram',
      'Create a new visual diagram in FlowCraft with optional starter templates (blank, microservices, checkout-flow, saas-er).',
      {
        title: z.string().describe('Title / name of the diagram'),
        description: z.string().optional().describe('Short summary of what this diagram describes'),
        category: z.enum(['system-design', 'flowchart', 'er-diagram', 'general']).optional().default('system-design'),
        tags: z.array(z.string()).optional(),
        template: z.enum(['blank', 'microservices', 'checkout-flow', 'saas-er']).optional().default('blank'),
        gridType: z.enum(['dots', 'lines', 'cross', 'none']).optional().default('dots'),
        defaultEdgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().default('smoothstep'),
      },
      async (params, extra) => {
        const userId = requireUserId(extra);
        const preset = params.template && params.template !== 'blank' ? TEMPLATE_PRESETS[params.template] : undefined;
        const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const diagram: Diagram = {
          id: newId,
          title: params.title.trim(),
          description: params.description?.trim() || '',
          category: (params.category || 'general') as DiagramCategory,
          tags: params.tags || [],
          nodes: preset ? JSON.parse(JSON.stringify(preset.nodes)) : [],
          edges: preset ? JSON.parse(JSON.stringify(preset.edges)) : [],
          settings: {
            gridType: params.gridType || 'dots',
            snapToGrid: true,
            defaultEdgeType: params.defaultEdgeType || 'smoothstep',
            gridGap: 20,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          const saved = await saveServerDiagram(diagram, userId);
          return jsonResult({
            success: true,
            message: `Created diagram "${saved.title}" successfully on ${LIVE_APP_URL}.`,
            diagramId: saved.id,
            category: saved.category,
            nodeCount: saved.nodes.length,
            edgeCount: saved.edges.length,
            editorUrl: getEditorUrl(saved.id),
          });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to create diagram.');
        }
      }
    );

    server.tool(
      'update_diagram',
      'Update diagram metadata (title, description, category, tags, or canvas settings).',
      {
        diagramId: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.enum(['system-design', 'flowchart', 'er-diagram', 'general']).optional(),
        tags: z.array(z.string()).optional(),
        gridType: z.enum(['dots', 'lines', 'cross', 'none']).optional(),
        defaultEdgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional(),
      },
      async ({ diagramId, title, description, category, tags, gridType, defaultEdgeType }, extra) => {
        const userId = requireUserId(extra);
        const existing = await getServerDiagram(diagramId, userId);
        if (!existing) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const updated: Diagram = {
          ...existing,
          title: title !== undefined ? title.trim() : existing.title,
          description: description !== undefined ? description.trim() : existing.description,
          category: (category as DiagramCategory) ?? existing.category,
          tags: tags ?? existing.tags,
          settings: {
            ...existing.settings,
            ...(gridType ? { gridType } : {}),
            ...(defaultEdgeType ? { defaultEdgeType } : {}),
          },
        };

        try {
          const saved = await saveServerDiagram(updated, userId, existing);
          return jsonResult({ success: true, message: 'Diagram updated.', diagram: saved, editorUrl: getEditorUrl(diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to update diagram.');
        }
      }
    );

    server.tool(
      'duplicate_diagram',
      'Duplicate / clone an existing diagram to a new copy owned by you.',
      { diagramId: z.string() },
      async ({ diagramId }, extra) => {
        const userId = requireUserId(extra);
        const source = await getServerDiagram(diagramId, userId);
        if (!source) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const cloned: Diagram = {
          ...JSON.parse(JSON.stringify(source)),
          id: newId,
          title: `${source.title} (Copy)`,
          userId,
          users: [{ userId, accesstype: 'ADMIN' }],
          isTemplate: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          const saved = await saveServerDiagram(cloned, userId, null);
          return jsonResult({ success: true, message: `Duplicated diagram to "${saved.title}"`, newDiagramId: saved.id, editorUrl: getEditorUrl(saved.id) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to duplicate diagram.');
        }
      }
    );

    server.tool(
      'delete_diagram',
      'Permanently delete a diagram by ID. Only the diagram ADMIN can delete it.',
      { diagramId: z.string() },
      async ({ diagramId }, extra) => {
        const userId = requireUserId(extra);
        try {
          const deleted = await deleteServerDiagram(diagramId, userId);
          if (!deleted) return errorResult(`Diagram "${diagramId}" not found, is a built-in template, or delete failed.`);
          return jsonResult({ success: true, message: `Diagram "${diagramId}" deleted successfully.` });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to delete diagram.');
        }
      }
    );

    server.tool(
      'tidy_diagram',
      'Automatically organize and align all nodes in a diagram using the hierarchical layout algorithm.',
      { diagramId: z.string() },
      async ({ diagramId }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const arrangedNodes = tidyLayout(diagram.nodes, diagram.edges);
        try {
          await saveServerDiagram({ ...diagram, nodes: arrangedNodes }, userId, diagram);
          return jsonResult({
            success: true,
            message: `Auto-arranged ${arrangedNodes.length} nodes in diagram "${diagram.title}".`,
            editorUrl: getEditorUrl(diagramId),
            nodes: arrangedNodes.map((n: any) => ({ id: n.id, title: n.data?.title || n.data?.label || n.data?.tableName, position: n.position })),
          });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to tidy diagram.');
        }
      }
    );

    // ==========================================
    // 2. NODE CRUD
    // ==========================================

    server.tool(
      'add_node',
      'Add a new node to a diagram. Supports system nodes, flowchart shapes, ER table nodes, sticky notes, and container groups.',
      {
        diagramId: z.string(),
        nodeId: z.string().optional().describe('Custom ID for node. If omitted, a unique ID is auto-generated.'),
        type: z.enum(['systemNode', 'flowchartNode', 'erTableNode', 'groupNode', 'stickyNode']),
        position: z.object({ x: z.number(), y: z.number() }).optional(),

        title: z.string().optional().describe('[systemNode] Primary title'),
        subtitle: z.string().optional().describe('[systemNode] Secondary tech info'),
        icon: z.string().optional().default('server'),
        category: z.string().optional().describe('[systemNode] Category badge'),
        status: z.string().optional().describe('[systemNode] Status pill'),
        themeColor: z.enum(['blue', 'indigo', 'emerald', 'amber', 'rose', 'purple', 'cyan', 'slate']).optional().default('blue'),

        label: z.string().optional().describe('[flowchartNode] Step text label'),
        description: z.string().optional().describe('[flowchartNode] Description'),
        shape: z.enum(['start-end', 'process', 'decision', 'input-output']).optional().default('process'),

        tableName: z.string().optional().describe('[erTableNode] SQL table name'),
        headerColor: z.enum(['blue', 'indigo', 'emerald', 'amber', 'rose', 'purple', 'slate']).optional().default('blue'),
        columns: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              isPrimary: z.boolean().optional(),
              isForeign: z.boolean().optional(),
              isNullable: z.boolean().optional(),
            })
          )
          .optional(),

        noteTitle: z.string().optional().describe('[stickyNode] Title'),
        noteText: z.string().optional().describe('[stickyNode] Content'),
        noteColor: z.enum(['yellow', 'blue', 'green', 'pink', 'purple']).optional().default('yellow'),

        groupLabel: z.string().optional().describe('[groupNode] Container label'),
        stylePreset: z.enum(['slate', 'blue', 'emerald', 'amber', 'purple', 'rose']).optional().default('slate'),
      },
      async (params, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(params.diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${params.diagramId}" not found or access denied.`);

        let nodeData: Record<string, any> = {};
        if (params.type === 'systemNode') {
          nodeData = { title: params.title || 'New Component', subtitle: params.subtitle || '', icon: params.icon || 'server', category: params.category || 'Compute', status: params.status || 'Active', themeColor: params.themeColor || 'blue' };
        } else if (params.type === 'flowchartNode') {
          nodeData = { label: params.label || 'Step', description: params.description || '', shape: params.shape || 'process', themeColor: params.themeColor || 'slate' };
        } else if (params.type === 'erTableNode') {
          nodeData = {
            tableName: params.tableName || 'new_table',
            headerColor: params.headerColor || 'blue',
            columns:
              params.columns && params.columns.length > 0
                ? params.columns.map((c, i) => ({ id: `col_${Date.now()}_${i}`, ...c }))
                : [
                    { id: 'c1', name: 'id', type: 'UUID', isPrimary: true },
                    { id: 'c2', name: 'created_at', type: 'TIMESTAMPTZ' },
                  ],
          };
        } else if (params.type === 'stickyNode') {
          nodeData = { title: params.noteTitle || 'Note', text: params.noteText || '', color: params.noteColor || 'yellow' };
        } else if (params.type === 'groupNode') {
          nodeData = { label: params.groupLabel || 'Container Group', stylePreset: params.stylePreset || 'slate' };
        }

        const nodeId = params.nodeId || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newNode: Node = {
          id: nodeId,
          type: params.type,
          position: params.position || { x: 100 + (diagram.nodes.length % 5) * 220, y: 100 + Math.floor(diagram.nodes.length / 5) * 160 },
          data: nodeData,
        };

        try {
          await saveServerDiagram({ ...diagram, nodes: [...diagram.nodes, newNode] }, userId, diagram);
          return jsonResult({ success: true, message: `Added node "${newNode.id}" (${params.type}) to diagram "${params.diagramId}".`, node: newNode, editorUrl: getEditorUrl(params.diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to add node.');
        }
      }
    );

    server.tool(
      'update_node',
      "Update an existing node's data or position (change title, status, ER columns, color, or move coordinates).",
      {
        diagramId: z.string(),
        nodeId: z.string(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        data: z.record(z.any()).optional().describe('Key-value pairs to merge into node data'),
      },
      async ({ diagramId, nodeId, position, data }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const index = diagram.nodes.findIndex((n: any) => n.id === nodeId);
        if (index === -1) return errorResult(`Node "${nodeId}" in diagram "${diagramId}" not found.`);

        const existingNode: any = diagram.nodes[index];
        const updatedNode = {
          ...existingNode,
          ...(position ? { position } : {}),
          ...(data ? { data: { ...existingNode.data, ...data } } : {}),
        };
        const nextNodes = [...diagram.nodes];
        nextNodes[index] = updatedNode;

        try {
          await saveServerDiagram({ ...diagram, nodes: nextNodes }, userId, diagram);
          return jsonResult({ success: true, message: `Updated node "${nodeId}".`, node: updatedNode, editorUrl: getEditorUrl(diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to update node.');
        }
      }
    );

    server.tool(
      'delete_node',
      'Delete a node from a diagram (automatically deletes any edges connected to it).',
      { diagramId: z.string(), nodeId: z.string() },
      async ({ diagramId, nodeId }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const nextNodes = diagram.nodes.filter((n: any) => n.id !== nodeId);
        if (nextNodes.length === diagram.nodes.length) return errorResult(`Node "${nodeId}" not found in diagram "${diagramId}".`);
        const nextEdges = diagram.edges.filter((e: any) => e.source !== nodeId && e.target !== nodeId);

        try {
          await saveServerDiagram({ ...diagram, nodes: nextNodes, edges: nextEdges }, userId, diagram);
          return jsonResult({ success: true, message: `Node "${nodeId}" and connected edges removed.`, editorUrl: getEditorUrl(diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to delete node.');
        }
      }
    );

    // ==========================================
    // 3. EDGE CRUD
    // ==========================================

    server.tool(
      'add_edge',
      'Connect two nodes in a diagram with a directional connection edge.',
      {
        diagramId: z.string(),
        source: z.string(),
        target: z.string(),
        edgeId: z.string().optional(),
        label: z.string().optional(),
        sourceHandle: z.enum(['top', 'right', 'bottom', 'left']).optional(),
        targetHandle: z.enum(['top', 'right', 'bottom', 'left']).optional(),
        edgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().default('smoothstep'),
        animated: z.boolean().optional().default(false),
        strokeColor: z.string().optional().default('#64748b'),
        strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional().default('solid'),
      },
      async (params, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(params.diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${params.diagramId}" not found or access denied.`);

        const hasSource = diagram.nodes.some((n: any) => n.id === params.source);
        const hasTarget = diagram.nodes.some((n: any) => n.id === params.target);
        if (!hasSource || !hasTarget) {
          return errorResult(`Invalid connection: source (${params.source}) or target (${params.target}) node not found in diagram.`);
        }

        const edgeId = params.edgeId || `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newEdge: Edge = {
          id: edgeId,
          source: params.source,
          target: params.target,
          type: 'customEdge',
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle,
          data: {
            label: params.label || '',
            edgeType: params.edgeType || diagram.settings?.defaultEdgeType || 'smoothstep',
            animated: params.animated ?? false,
            strokeColor: params.strokeColor || '#64748b',
            strokeStyle: params.strokeStyle || 'solid',
          },
        };

        try {
          await saveServerDiagram({ ...diagram, edges: [...diagram.edges, newEdge] }, userId, diagram);
          return jsonResult({ success: true, message: `Connected "${params.source}" -> "${params.target}".`, edge: newEdge, editorUrl: getEditorUrl(params.diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to add edge.');
        }
      }
    );

    server.tool(
      'update_edge',
      "Update an existing edge's label, curve style, animation, or stroke color.",
      {
        diagramId: z.string(),
        edgeId: z.string(),
        label: z.string().optional(),
        edgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional(),
        animated: z.boolean().optional(),
        strokeColor: z.string().optional(),
        strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
      },
      async ({ diagramId, edgeId, ...patch }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const index = diagram.edges.findIndex((e: any) => e.id === edgeId);
        if (index === -1) return errorResult(`Edge "${edgeId}" not found in diagram "${diagramId}".`);

        const existingEdge: any = diagram.edges[index];
        const updatedEdge = { ...existingEdge, data: { ...existingEdge.data, ...patch } };
        const nextEdges = [...diagram.edges];
        nextEdges[index] = updatedEdge;

        try {
          await saveServerDiagram({ ...diagram, edges: nextEdges }, userId, diagram);
          return jsonResult({ success: true, message: `Edge "${edgeId}" updated.`, edge: updatedEdge, editorUrl: getEditorUrl(diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to update edge.');
        }
      }
    );

    server.tool(
      'delete_edge',
      'Delete a connection edge between nodes.',
      { diagramId: z.string(), edgeId: z.string() },
      async ({ diagramId, edgeId }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const nextEdges = diagram.edges.filter((e: any) => e.id !== edgeId);
        if (nextEdges.length === diagram.edges.length) return errorResult(`Edge "${edgeId}" not found in diagram "${diagramId}".`);

        try {
          await saveServerDiagram({ ...diagram, edges: nextEdges }, userId, diagram);
          return jsonResult({ success: true, message: `Edge "${edgeId}" deleted.`, editorUrl: getEditorUrl(diagramId) });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to delete edge.');
        }
      }
    );

    // ==========================================
    // 4. BATCH CREATION
    // ==========================================

    server.tool(
      'batch_add_elements',
      'Add multiple nodes and edges to a diagram in a single atomic call. Best for generating entire systems, workflows, or architectures.',
      {
        diagramId: z.string(),
        nodes: z.array(
          z.object({
            id: z.string(),
            type: z.enum(['systemNode', 'flowchartNode', 'erTableNode', 'groupNode', 'stickyNode']),
            position: z.object({ x: z.number(), y: z.number() }).optional(),
            data: z.record(z.any()),
          })
        ),
        edges: z
          .array(
            z.object({
              id: z.string().optional(),
              source: z.string(),
              target: z.string(),
              label: z.string().optional(),
              edgeType: z.enum(['smoothstep', 'bezier', 'straight']).optional().default('smoothstep'),
              animated: z.boolean().optional().default(false),
              strokeColor: z.string().optional().default('#64748b'),
            })
          )
          .optional()
          .default([]),
        autoLayout: z.boolean().optional().default(true),
      },
      async ({ diagramId, nodes, edges, autoLayout }, extra) => {
        const userId = requireUserId(extra);
        const diagram = await getServerDiagram(diagramId, userId);
        if (!diagram) return errorResult(`Diagram "${diagramId}" not found or access denied.`);

        const preparedNodes: Node[] = nodes.map((n, i) => ({
          id: n.id,
          type: n.type,
          position: n.position || { x: 100 + (i % 4) * 260, y: 100 + Math.floor(i / 4) * 160 },
          data: n.data,
        }));

        const preparedEdges: Edge[] = (edges || []).map((e, i) => ({
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

        try {
          let finalNodes: Node[];
          let finalEdges: Edge[];
          if (autoLayout) {
            const allNodes = [...diagram.nodes, ...preparedNodes];
            finalEdges = [...diagram.edges, ...preparedEdges];
            finalNodes = tidyLayout(allNodes, finalEdges);
          } else {
            const existingNodeIds = new Set(diagram.nodes.map((n: any) => n.id));
            const existingEdgeIds = new Set(diagram.edges.map((e: any) => e.id));
            finalNodes = [...diagram.nodes, ...preparedNodes.filter((n) => !existingNodeIds.has(n.id))];
            finalEdges = [...diagram.edges, ...preparedEdges.filter((e) => !existingEdgeIds.has(e.id))];
          }

          await saveServerDiagram({ ...diagram, nodes: finalNodes, edges: finalEdges }, userId, diagram);
          return jsonResult({
            success: true,
            message: `Batch added ${nodes.length} nodes and ${(edges || []).length} edges to diagram "${diagram.title}".`,
            totalNodes: finalNodes.length,
            totalEdges: finalEdges.length,
            editorUrl: getEditorUrl(diagramId),
          });
        } catch (err: any) {
          return errorResult(err.message || 'Failed to batch add elements.');
        }
      }
    );
  },
  {
    serverInfo: { name: 'flowcraft-mcp-server', version: '1.0.0' },
  },
  {
    basePath: '/api',
    maxDuration: 60,
    disableSse: true,
    verboseLogs: false,
  }
);

const verifyToken = async (_req: Request, bearerToken?: string) => {
  if (!bearerToken) return undefined;
  const payload = verifyAccessToken(bearerToken);
  if (!payload?.userId) return undefined;
  return {
    token: bearerToken,
    clientId: payload.userId,
    scopes: [],
    extra: { userId: payload.userId, email: payload.email, name: payload.name } as McpAuthExtra,
  };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };

export const maxDuration = 60;
