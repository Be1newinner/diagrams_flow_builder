import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Path to shared data/diagrams.json
const DATA_PATH = process.env.FLOW_DATA_PATH || path.resolve(__dirname, '../../data/diagrams.json');
export function getStorageFilePath() {
    return DATA_PATH;
}
function ensureDataFile() {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2), 'utf-8');
    }
}
export function getAllDiagrams() {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    catch (error) {
        console.error('[FlowCraft MCP] Error reading diagrams file:', error);
        return [];
    }
}
export function getDiagramById(id) {
    const diagrams = getAllDiagrams();
    return diagrams.find((d) => d.id === id) || null;
}
export function saveDiagram(diagram) {
    ensureDataFile();
    const diagrams = getAllDiagrams();
    const index = diagrams.findIndex((d) => d.id === diagram.id);
    const updated = {
        ...diagram,
        updatedAt: new Date().toISOString(),
    };
    let nextList;
    if (index >= 0) {
        nextList = [...diagrams];
        nextList[index] = updated;
    }
    else {
        nextList = [updated, ...diagrams];
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(nextList, null, 2), 'utf-8');
    return updated;
}
export function createDiagram(params) {
    const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let initialNodes = [];
    let initialEdges = [];
    if (params.template === 'microservices') {
        initialNodes = [
            {
                id: 'node-client',
                type: 'systemNode',
                position: { x: 50, y: 150 },
                data: { title: 'Web App', subtitle: 'Next.js Client', icon: 'smartphone', category: 'Client', themeColor: 'blue' }
            },
            {
                id: 'node-gw',
                type: 'systemNode',
                position: { x: 320, y: 150 },
                data: { title: 'API Gateway', subtitle: 'Envoy / Kong', icon: 'arrow-left-right', category: 'Network', themeColor: 'indigo' }
            },
            {
                id: 'node-svc',
                type: 'systemNode',
                position: { x: 600, y: 150 },
                data: { title: 'Core Service', subtitle: 'Go Microservice', icon: 'server', category: 'Compute', themeColor: 'emerald' }
            },
            {
                id: 'node-db',
                type: 'systemNode',
                position: { x: 880, y: 150 },
                data: { title: 'PostgreSQL DB', subtitle: 'RDS Primary', icon: 'database', category: 'Database', themeColor: 'blue' }
            }
        ];
        initialEdges = [
            { id: 'e1', source: 'node-client', target: 'node-gw', type: 'customEdge', data: { label: 'HTTPS / JSON', edgeType: 'smoothstep' } },
            { id: 'e2', source: 'node-gw', target: 'node-svc', type: 'customEdge', data: { label: '/api/v1', edgeType: 'smoothstep' } },
            { id: 'e3', source: 'node-svc', target: 'node-db', type: 'customEdge', data: { label: 'SQL queries', edgeType: 'smoothstep' } }
        ];
    }
    else if (params.template === 'checkout-flow') {
        initialNodes = [
            { id: 'fc-1', type: 'flowchartNode', position: { x: 250, y: 40 }, data: { label: 'Start Checkout', shape: 'start-end', themeColor: 'blue' } },
            { id: 'fc-2', type: 'flowchartNode', position: { x: 250, y: 160 }, data: { label: 'Validate Stock', shape: 'process', themeColor: 'slate' } },
            { id: 'fc-3', type: 'flowchartNode', position: { x: 250, y: 280 }, data: { label: 'Charge Payment', shape: 'process', themeColor: 'emerald' } },
            { id: 'fc-4', type: 'flowchartNode', position: { x: 250, y: 400 }, data: { label: 'Order Complete', shape: 'start-end', themeColor: 'emerald' } }
        ];
        initialEdges = [
            { id: 'e1', source: 'fc-1', target: 'fc-2', type: 'customEdge', data: { label: '', edgeType: 'smoothstep' } },
            { id: 'e2', source: 'fc-2', target: 'fc-3', type: 'customEdge', data: { label: 'In Stock', edgeType: 'smoothstep' } },
            { id: 'e3', source: 'fc-3', target: 'fc-4', type: 'customEdge', data: { label: 'Paid 200 OK', edgeType: 'smoothstep' } }
        ];
    }
    else if (params.template === 'saas-er') {
        initialNodes = [
            {
                id: 'table-users',
                type: 'erTableNode',
                position: { x: 100, y: 100 },
                data: {
                    tableName: 'users',
                    headerColor: 'blue',
                    columns: [
                        { id: 'c1', name: 'id', type: 'UUID', isPrimary: true },
                        { id: 'c2', name: 'email', type: 'VARCHAR(255)' },
                        { id: 'c3', name: 'created_at', type: 'TIMESTAMPTZ' }
                    ]
                }
            },
            {
                id: 'table-teams',
                type: 'erTableNode',
                position: { x: 450, y: 100 },
                data: {
                    tableName: 'teams',
                    headerColor: 'indigo',
                    columns: [
                        { id: 't1', name: 'id', type: 'UUID', isPrimary: true },
                        { id: 't2', name: 'name', type: 'VARCHAR(100)' },
                        { id: 't3', name: 'owner_id', type: 'UUID', isForeign: true }
                    ]
                }
            }
        ];
        initialEdges = [
            { id: 'e1', source: 'table-users', target: 'table-teams', type: 'customEdge', data: { label: '1 : N (Owns)', edgeType: 'smoothstep' } }
        ];
    }
    const diagram = {
        id: newId,
        title: params.title.trim(),
        description: params.description?.trim() || '',
        category: params.category || 'general',
        tags: params.tags || [],
        nodes: initialNodes,
        edges: initialEdges,
        settings: {
            gridType: params.gridType || 'dots',
            snapToGrid: true,
            defaultEdgeType: params.defaultEdgeType || 'smoothstep',
            gridGap: 20
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    return saveDiagram(diagram);
}
export function updateDiagram(id, patch) {
    const existing = getDiagramById(id);
    if (!existing)
        return null;
    const updated = {
        ...existing,
        ...patch,
        id,
        updatedAt: new Date().toISOString()
    };
    return saveDiagram(updated);
}
export function deleteDiagram(id) {
    ensureDataFile();
    const diagrams = getAllDiagrams();
    const filtered = diagrams.filter((d) => d.id !== id);
    if (filtered.length === diagrams.length)
        return false;
    fs.writeFileSync(DATA_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
}
export function duplicateDiagram(id) {
    const source = getDiagramById(id);
    if (!source)
        return null;
    const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cloned = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        title: `${source.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    return saveDiagram(cloned);
}
// ----------------- NODE CRUD -----------------
export function addNodeToDiagram(diagramId, node) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return null;
    const nodeId = node.id || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullNode = {
        id: nodeId,
        type: node.type || 'systemNode',
        position: node.position || {
            x: 100 + (diagram.nodes.length % 5) * 220,
            y: 100 + Math.floor(diagram.nodes.length / 5) * 160
        },
        data: node.data || {}
    };
    diagram.nodes.push(fullNode);
    saveDiagram(diagram);
    return fullNode;
}
export function updateNodeInDiagram(diagramId, nodeId, patch) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return null;
    const index = diagram.nodes.findIndex((n) => n.id === nodeId);
    if (index === -1)
        return null;
    const existingNode = diagram.nodes[index];
    const updatedNode = {
        ...existingNode,
        ...(patch.type ? { type: patch.type } : {}),
        ...(patch.position ? { position: patch.position } : {}),
        ...(patch.data ? { data: { ...existingNode.data, ...patch.data } } : {})
    };
    diagram.nodes[index] = updatedNode;
    saveDiagram(diagram);
    return updatedNode;
}
export function deleteNodeFromDiagram(diagramId, nodeId) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return false;
    const nodeCountBefore = diagram.nodes.length;
    diagram.nodes = diagram.nodes.filter((n) => n.id !== nodeId);
    if (diagram.nodes.length === nodeCountBefore)
        return false;
    diagram.edges = diagram.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    saveDiagram(diagram);
    return true;
}
// ----------------- EDGE CRUD -----------------
export function addEdgeToDiagram(diagramId, params) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return null;
    const hasSource = diagram.nodes.some((n) => n.id === params.source);
    const hasTarget = diagram.nodes.some((n) => n.id === params.target);
    if (!hasSource || !hasTarget) {
        throw new Error(`Invalid connection: source (${params.source}) or target (${params.target}) node not found in diagram.`);
    }
    const edgeId = params.id || `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEdge = {
        id: edgeId,
        source: params.source,
        target: params.target,
        type: 'customEdge',
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        data: {
            label: params.label || '',
            edgeType: params.edgeType || diagram.settings.defaultEdgeType || 'smoothstep',
            animated: params.animated ?? false,
            strokeColor: params.strokeColor || '#64748b',
            strokeStyle: params.strokeStyle || 'solid'
        }
    };
    diagram.edges.push(fullEdge);
    saveDiagram(diagram);
    return fullEdge;
}
export function updateEdgeInDiagram(diagramId, edgeId, patch) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return null;
    const index = diagram.edges.findIndex((e) => e.id === edgeId);
    if (index === -1)
        return null;
    const existingEdge = diagram.edges[index];
    const updatedEdge = {
        ...existingEdge,
        data: {
            ...existingEdge.data,
            ...patch
        }
    };
    diagram.edges[index] = updatedEdge;
    saveDiagram(diagram);
    return updatedEdge;
}
export function deleteEdgeFromDiagram(diagramId, edgeId) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return false;
    const edgeCountBefore = diagram.edges.length;
    diagram.edges = diagram.edges.filter((e) => e.id !== edgeId);
    if (diagram.edges.length === edgeCountBefore)
        return false;
    saveDiagram(diagram);
    return true;
}
// ----------------- BATCH ADD -----------------
export function batchAddElements(diagramId, nodes, edges) {
    const diagram = getDiagramById(diagramId);
    if (!diagram)
        return null;
    const existingNodeIds = new Set(diagram.nodes.map((n) => n.id));
    const existingEdgeIds = new Set(diagram.edges.map((e) => e.id));
    let nodesAdded = 0;
    for (const node of nodes) {
        if (!existingNodeIds.has(node.id)) {
            diagram.nodes.push(node);
            existingNodeIds.add(node.id);
            nodesAdded++;
        }
    }
    let edgesAdded = 0;
    for (const edge of edges) {
        if (!existingEdgeIds.has(edge.id)) {
            diagram.edges.push(edge);
            existingEdgeIds.add(edge.id);
            edgesAdded++;
        }
    }
    saveDiagram(diagram);
    return { nodesAdded, edgesAdded };
}
