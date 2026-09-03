import { Diagram, DiagramCategory } from '@/types/diagram';
import { STARTER_TEMPLATES } from './templates';

const STORAGE_KEY = 'flowcraft_diagrams_v1';

export function getDiagrams(): Diagram[] {
  if (typeof window === 'undefined') return STARTER_TEMPLATES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let diagrams = STARTER_TEMPLATES;
    if (raw) {
      const parsed: Diagram[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        diagrams = parsed;
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STARTER_TEMPLATES));
    }

    // Background sync with server API
    syncWithServer();

    return diagrams.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Error reading diagrams from storage:', error);
    return STARTER_TEMPLATES;
  }
}

let isSyncing = false;
async function syncWithServer() {
  if (typeof window === 'undefined' || isSyncing) return;
  isSyncing = true;
  try {
    const res = await fetch('/api/diagrams');
    if (res.ok) {
      const serverDiagrams: Diagram[] = await res.json();
      if (Array.isArray(serverDiagrams) && serverDiagrams.length > 0) {
        const raw = localStorage.getItem(STORAGE_KEY);
        const localList: Diagram[] = raw ? JSON.parse(raw) : [];

        // Check if server has differences or newer diagrams
        const localMap = new Map(localList.map((d) => [d.id, d]));
        let hasChanges = false;

        serverDiagrams.forEach((sd) => {
          const local = localMap.get(sd.id);
          if (!local || new Date(sd.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
            localMap.set(sd.id, sd);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          const merged = Array.from(localMap.values()).sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('flowcraft:storage-update'));
        }
      }
    }
  } catch {
    // offline or backend not reached
  } finally {
    isSyncing = false;
  }
}

export function getDiagram(id: string): Diagram | null {
  const diagrams = getDiagrams();
  return diagrams.find((d) => d.id === id) || null;
}

export function saveDiagram(diagram: Diagram): void {
  if (typeof window === 'undefined') return;
  try {
    const diagrams = getDiagrams();
    const existingIndex = diagrams.findIndex((d) => d.id === diagram.id);
    const updatedDiagram: Diagram = {
      ...diagram,
      updatedAt: new Date().toISOString(),
    };

    let nextList: Diagram[];
    if (existingIndex >= 0) {
      nextList = [...diagrams];
      nextList[existingIndex] = updatedDiagram;
    } else {
      nextList = [updatedDiagram, ...diagrams];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('flowcraft:storage-update', { detail: { id: diagram.id } }));

    // Send to backend API
    fetch(`/api/diagrams/${diagram.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDiagram),
    }).catch(() => {
      // Fallback: create if 404
      fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDiagram),
      }).catch(() => {});
    });
  } catch (error) {
    console.error('Error saving diagram:', error);
  }
}

export function createDiagram(params: {
  title: string;
  description?: string;
  category: DiagramCategory;
  tags?: string[];
  templateId?: string;
  gridType?: 'dots' | 'lines' | 'cross' | 'none';
  defaultEdgeType?: 'smoothstep' | 'bezier' | 'straight';
}): Diagram {
  let initialNodes: Diagram['nodes'] = [];
  let initialEdges: Diagram['edges'] = [];

  if (params.templateId && params.templateId !== 'blank') {
    const template = STARTER_TEMPLATES.find((t) => t.id === params.templateId);
    if (template) {
      initialNodes = JSON.parse(JSON.stringify(template.nodes));
      initialEdges = JSON.parse(JSON.stringify(template.edges));
    }
  }

  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newDiagram: Diagram = {
    id: newId,
    title: params.title.trim() || 'Untitled Diagram',
    description: params.description?.trim() || '',
    category: params.category || 'general',
    tags: params.tags || [],
    nodes: initialNodes,
    edges: initialEdges,
    settings: {
      gridType: params.gridType || 'dots',
      snapToGrid: true,
      defaultEdgeType: params.defaultEdgeType || 'smoothstep',
      gridGap: 20,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDiagram(newDiagram);
  return newDiagram;
}

export function duplicateDiagram(id: string): Diagram | null {
  const source = getDiagram(id);
  if (!source) return null;

  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cloned: Diagram = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    title: `${source.title} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDiagram(cloned);
  return cloned;
}

export function deleteDiagram(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const diagrams = getDiagrams();
    const filtered = diagrams.filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('flowcraft:storage-update', { detail: { id } }));

    // Delete from backend API
    fetch(`/api/diagrams/${id}`, { method: 'DELETE' }).catch(() => {});
    return true;
  } catch (error) {
    console.error('Error deleting diagram:', error);
    return false;
  }
}

export function exportDiagramJSON(id: string): string {
  const diagram = getDiagram(id);
  if (!diagram) throw new Error('Diagram not found');
  return JSON.stringify(diagram, null, 2);
}

export function importDiagramJSON(jsonString: string): Diagram {
  const parsed = JSON.parse(jsonString);
  if (!parsed || !parsed.title || !Array.isArray(parsed.nodes)) {
    throw new Error('Invalid diagram JSON schema');
  }

  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const imported: Diagram = {
    ...parsed,
    id: newId,
    title: `${parsed.title} (Imported)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDiagram(imported);
  return imported;
}
