import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, Collection } from 'mongodb';
import { Diagram, DiagramCategory, DiagramNode, DiagramEdge } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Live Vercel Application Configuration
export const DEFAULT_APP_URL = 'https://diagrams-flow-builder.vercel.app';
export const APP_URL = process.env.FLOW_APP_URL || DEFAULT_APP_URL;
export const API_URL = process.env.FLOW_API_URL || `${APP_URL}/api/diagrams`;

// Long-lived MCP JWT (see lib/auth.ts generateMcpToken on the frontend) — required
// for the Vercel API to attribute writes to a real account instead of rejecting them.
const MCP_TOKEN = process.env.FLOW_MCP_TOKEN;
if (!MCP_TOKEN) {
  console.error('[FlowCraft MCP] FLOW_MCP_TOKEN is not set — writes to the live API will be rejected (401) and silently fall back to local storage.');
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return MCP_TOKEN ? { ...extra, Authorization: `Bearer ${MCP_TOKEN}` } : extra;
}

export function getAppUrl(): string {
  return APP_URL;
}

export function getEditorUrl(id: string): string {
  return `${APP_URL}/flow/${id}`;
}

// Shared File Fallback Path
const DATA_PATH = process.env.FLOW_DATA_PATH || path.resolve(__dirname, '../../data/diagrams.json');

// MongoDB Atlas Configuration
const MONGO_URI = process.env.MONGODB_URI;
let mongoClient: MongoClient | null = null;

async function getMongoCollection(): Promise<Collection<Diagram> | null> {
  if (!MONGO_URI) return null;
  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGO_URI);
      await mongoClient.connect();
    }
    const db = mongoClient.db('flowcraft');
    return db.collection<Diagram>('diagrams');
  } catch (err: any) {
    console.error('[FlowCraft MCP] MongoDB connection error:', err?.message || err);
    return null;
  }
}

export function getStorageFilePath(): string {
  return `Live Vercel (${API_URL}) & MongoDB Atlas [Fallback: ${DATA_PATH}]`;
}

// File Helpers
function ensureDataFile(): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2), 'utf-8');
}

function getFileDiagrams(): Diagram[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const parsed: Diagram[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFileDiagram(diagram: Diagram): void {
  try {
    ensureDataFile();
    const list = getFileDiagrams();
    const idx = list.findIndex((d) => d.id === diagram.id);
    let nextList: Diagram[];
    if (idx >= 0) {
      nextList = [...list];
      nextList[idx] = diagram;
    } else {
      nextList = [diagram, ...list];
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(nextList, null, 2), 'utf-8');
  } catch (err) {
    console.error('[FlowCraft MCP] File save error:', err);
  }
}

function deleteFileDiagram(id: string): boolean {
  try {
    ensureDataFile();
    const list = getFileDiagrams();
    const filtered = list.filter((d) => d.id !== id);
    if (filtered.length === list.length) return false;
    fs.writeFileSync(DATA_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// ----------------- MAIN ASYNC METHODS -----------------

export async function getAllDiagrams(): Promise<Diagram[]> {
  // 1. Try Live Vercel API first
  if (API_URL) {
    try {
      const res = await fetch(API_URL, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
      }
    } catch (err) {
      console.error('[FlowCraft MCP] Vercel API fetch error, trying MongoDB:', err);
    }
  }

  // 2. Try MongoDB Atlas direct
  const collection = await getMongoCollection();
  if (collection) {
    try {
      const docs = await collection.find({}).sort({ updatedAt: -1 }).toArray();
      return docs.map(({ _id, ...rest }: any) => rest as Diagram);
    } catch (err) {
      console.error('[FlowCraft MCP] Error fetching from MongoDB:', err);
    }
  }

  // 3. Fallback to local file
  const list = getFileDiagrams();
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getDiagramById(id: string): Promise<Diagram | null> {
  // 1. Try Live Vercel API
  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/${id}`, { headers: authHeaders() });
      if (res.ok) {
        return (await res.json()) as Diagram;
      }
    } catch (err) {
      // try fallback
    }
  }

  // 2. Try MongoDB
  const collection = await getMongoCollection();
  if (collection) {
    try {
      const doc = await collection.findOne({ id });
      if (doc) {
        const { _id, ...rest } = doc as any;
        return rest as Diagram;
      }
    } catch (err) {
      console.error('[FlowCraft MCP] MongoDB error:', err);
    }
  }

  const list = getFileDiagrams();
  return list.find((d) => d.id === id) || null;
}

export async function saveDiagram(diagram: Diagram): Promise<Diagram> {
  const updated: Diagram = {
    ...diagram,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to Live Vercel API
  if (API_URL) {
    try {
      await fetch(`${API_URL}/${updated.id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updated),
      }).then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          console.error(`[FlowCraft MCP] Vercel API rejected write (${res.status}) — check FLOW_MCP_TOKEN is set and valid.`);
        } else if (!res.ok) {
          // If 404, create
          const createRes = await fetch(API_URL, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(updated),
          });
          if (createRes.status === 401 || createRes.status === 403) {
            console.error(`[FlowCraft MCP] Vercel API rejected create (${createRes.status}) — check FLOW_MCP_TOKEN is set and valid.`);
          }
        }
      });
    } catch (err) {
      console.error('[FlowCraft MCP] Vercel API save error:', err);
    }
  }

  // 2. Also save to MongoDB Atlas directly if connected
  const collection = await getMongoCollection();
  if (collection) {
    try {
      await collection.updateOne(
        { id: updated.id },
        { $set: updated },
        { upsert: true }
      );
    } catch (err) {
      console.error('[FlowCraft MCP] MongoDB save error:', err);
    }
  }

  saveFileDiagram(updated);
  return updated;
}

export async function createDiagram(params: {
  title: string;
  description?: string;
  category?: DiagramCategory;
  tags?: string[];
  template?: 'blank' | 'microservices' | 'checkout-flow' | 'saas-er';
  gridType?: 'dots' | 'lines' | 'cross' | 'none';
  defaultEdgeType?: 'smoothstep' | 'bezier' | 'straight';
}): Promise<Diagram> {
  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  let initialNodes: DiagramNode[] = [];
  let initialEdges: DiagramEdge[] = [];

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
  } else if (params.template === 'checkout-flow') {
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
  } else if (params.template === 'saas-er') {
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

  const diagram: Diagram = {
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

  return await saveDiagram(diagram);
}

export async function updateDiagram(id: string, patch: Partial<Diagram>): Promise<Diagram | null> {
  const existing = await getDiagramById(id);
  if (!existing) return null;

  const updated: Diagram = {
    ...existing,
    ...patch,
    id,
    updatedAt: new Date().toISOString()
  };

  return await saveDiagram(updated);
}

export async function deleteDiagram(id: string): Promise<boolean> {
  // 1. Delete on Vercel API
  if (API_URL) {
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.status === 401 || res.status === 403) {
        console.error(`[FlowCraft MCP] Vercel API rejected delete (${res.status}) — check FLOW_MCP_TOKEN is set and valid.`);
      }
    } catch (err) {
      console.error('[FlowCraft MCP] Vercel API delete error:', err);
    }
  }

  // 2. Delete on MongoDB Atlas
  let deletedFromMongo = false;
  const collection = await getMongoCollection();
  if (collection) {
    try {
      const res = await collection.deleteOne({ id });
      deletedFromMongo = res.deletedCount > 0;
    } catch (err) {
      console.error('[FlowCraft MCP] Error deleting from MongoDB:', err);
    }
  }

  const deletedFromFile = deleteFileDiagram(id);
  return deletedFromMongo || deletedFromFile;
}

export async function duplicateDiagram(id: string): Promise<Diagram | null> {
  const source = await getDiagramById(id);
  if (!source) return null;

  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cloned: Diagram = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    title: `${source.title} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return await saveDiagram(cloned);
}

// ----------------- NODE CRUD -----------------
export async function addNodeToDiagram(diagramId: string, node: Partial<DiagramNode>): Promise<DiagramNode | null> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return null;

  const nodeId = node.id || `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullNode: DiagramNode = {
    id: nodeId,
    type: node.type || 'systemNode',
    position: node.position || {
      x: 100 + (diagram.nodes.length % 5) * 220,
      y: 100 + Math.floor(diagram.nodes.length / 5) * 160
    },
    data: node.data || {}
  };

  diagram.nodes.push(fullNode);
  await saveDiagram(diagram);
  return fullNode;
}

export async function updateNodeInDiagram(
  diagramId: string,
  nodeId: string,
  patch: { position?: { x: number; y: number }; data?: Record<string, any>; type?: string }
): Promise<DiagramNode | null> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return null;

  const index = diagram.nodes.findIndex((n) => n.id === nodeId);
  if (index === -1) return null;

  const existingNode = diagram.nodes[index];
  const updatedNode: DiagramNode = {
    ...existingNode,
    ...(patch.type ? { type: patch.type } : {}),
    ...(patch.position ? { position: patch.position } : {}),
    ...(patch.data ? { data: { ...existingNode.data, ...patch.data } } : {})
  };

  diagram.nodes[index] = updatedNode;
  await saveDiagram(diagram);
  return updatedNode;
}

export async function deleteNodeFromDiagram(diagramId: string, nodeId: string): Promise<boolean> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return false;

  const nodeCountBefore = diagram.nodes.length;
  diagram.nodes = diagram.nodes.filter((n) => n.id !== nodeId);
  if (diagram.nodes.length === nodeCountBefore) return false;

  diagram.edges = diagram.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  await saveDiagram(diagram);
  return true;
}

// ----------------- EDGE CRUD -----------------
export async function addEdgeToDiagram(
  diagramId: string,
  params: {
    source: string;
    target: string;
    id?: string;
    label?: string;
    sourceHandle?: string;
    targetHandle?: string;
    edgeType?: 'smoothstep' | 'bezier' | 'straight';
    animated?: boolean;
    strokeColor?: string;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
  }
): Promise<DiagramEdge | null> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return null;

  const hasSource = diagram.nodes.some((n) => n.id === params.source);
  const hasTarget = diagram.nodes.some((n) => n.id === params.target);
  if (!hasSource || !hasTarget) {
    throw new Error(`Invalid connection: source (${params.source}) or target (${params.target}) node not found in diagram.`);
  }

  const edgeId = params.id || `e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullEdge: DiagramEdge = {
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
  await saveDiagram(diagram);
  return fullEdge;
}

export async function updateEdgeInDiagram(
  diagramId: string,
  edgeId: string,
  patch: {
    label?: string;
    edgeType?: 'smoothstep' | 'bezier' | 'straight';
    animated?: boolean;
    strokeColor?: string;
    strokeStyle?: 'solid' | 'dashed' | 'dotted';
  }
): Promise<DiagramEdge | null> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return null;

  const index = diagram.edges.findIndex((e) => e.id === edgeId);
  if (index === -1) return null;

  const existingEdge = diagram.edges[index];
  const updatedEdge: DiagramEdge = {
    ...existingEdge,
    data: {
      ...existingEdge.data,
      ...patch
    }
  };

  diagram.edges[index] = updatedEdge;
  await saveDiagram(diagram);
  return updatedEdge;
}

export async function deleteEdgeFromDiagram(diagramId: string, edgeId: string): Promise<boolean> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return false;

  const edgeCountBefore = diagram.edges.length;
  diagram.edges = diagram.edges.filter((e) => e.id !== edgeId);
  if (diagram.edges.length === edgeCountBefore) return false;

  await saveDiagram(diagram);
  return true;
}

// ----------------- BATCH ADD -----------------
export async function batchAddElements(
  diagramId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Promise<{ nodesAdded: number; edgesAdded: number } | null> {
  const diagram = await getDiagramById(diagramId);
  if (!diagram) return null;

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

  await saveDiagram(diagram);
  return { nodesAdded, edgesAdded };
}
