import { Diagram, DiagramCategory } from '@/types/diagram';
import { STARTER_TEMPLATES } from './templates';

export function getStorageKey(userId?: string | null): string {
  return userId ? `flowcraft_diagrams_user_${userId}` : 'flowcraft_diagrams_guest_v2';
}

// Clean up legacy shared key from previous sessions
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('flowcraft_diagrams_v1');
  } catch {}
}

export function getDiagrams(userId?: string | null): Diagram[] {
  // Unauthenticated guests see ONLY the 3 starter sample templates
  if (!userId) {
    return STARTER_TEMPLATES;
  }

  if (typeof window === 'undefined') return STARTER_TEMPLATES;

  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    let diagrams: Diagram[] = [];

    if (raw) {
      const parsed: Diagram[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        diagrams = parsed;
      }
    }

    // Ensure starter templates are always included
    const existingIds = new Set(diagrams.map((d) => d.id));
    const missingTemplates = STARTER_TEMPLATES.filter((t) => !existingIds.has(t.id));
    if (missingTemplates.length > 0) {
      diagrams = [...diagrams, ...missingTemplates];
      localStorage.setItem(key, JSON.stringify(diagrams));
    }

    // Sync in background with user-scoped server API
    syncWithServer(userId);

    return diagrams.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Error reading diagrams from storage:', error);
    return STARTER_TEMPLATES;
  }
}

let isSyncing = false;
async function syncWithServer(userId?: string | null) {
  if (typeof window === 'undefined' || isSyncing || !userId) return;
  isSyncing = true;
  try {
    const res = await fetch('/api/diagrams');
    if (res.ok) {
      const serverDiagrams: Diagram[] = await res.json();
      if (Array.isArray(serverDiagrams)) {
        const key = getStorageKey(userId);
        const raw = localStorage.getItem(key);
        const localList: Diagram[] = raw ? JSON.parse(raw) : [];

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
          localStorage.setItem(key, JSON.stringify(merged));
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

export function getDiagram(id: string, userId?: string | null): Diagram | null {
  // 1. Check starter templates first (viewable by everyone)
  const template = STARTER_TEMPLATES.find((t) => t.id === id);
  if (template) return template;

  if (typeof window === 'undefined') return null;

  // 2. If userId provided, check that user's scoped storage
  if (userId) {
    try {
      const key = getStorageKey(userId);
      const raw = localStorage.getItem(key);
      if (raw) {
        const list: Diagram[] = JSON.parse(raw);
        const found = list.find((d) => d.id === id);
        if (found) return found;
      }
    } catch {}
  }

  // 3. Fallback: Search all user storage keys in case userId is still resolving
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('flowcraft_diagrams_user_')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list: Diagram[] = JSON.parse(raw);
          const found = list.find((d) => d.id === id);
          if (found) return found;
        }
      }
    }
  } catch {}

  return null;
}

export type SaveResult =
  | { status: 'ok'; diagram: Diagram }
  | { status: 'created'; diagram: Diagram }
  | { status: 'conflict'; latest: Diagram }
  | { status: 'error' };

// Saves locally (instant) and to the server (async), using optimistic
// concurrency: `diagram.updatedAt` as passed in is the version this edit was
// based on ("baseVersion"). If the server's copy has moved on since then —
// another tab, another user, or an MCP tool call saved in between — the
// server rejects with 409 instead of silently letting last-write-wins
// clobber that other edit. Callers should inspect the returned SaveResult.
export function saveDiagram(diagram: Diagram, userId?: string | null): Promise<SaveResult> {
  if (typeof window === 'undefined') return Promise.resolve({ status: 'error' });

  // Cannot modify built-in starter templates
  if (diagram.isTemplate || diagram.id.startsWith('template-')) {
    return Promise.resolve({ status: 'error' });
  }

  const baseVersion = diagram.updatedAt;

  try {
    const key = getStorageKey(userId);
    const diagrams = getDiagrams(userId);
    const updatedDiagram: Diagram = {
      ...diagram,
      userId: userId || diagram.userId || undefined,
      users: diagram.users && diagram.users.length > 0
        ? diagram.users
        : (userId ? [{ userId, accesstype: 'ADMIN' }] : undefined),
      isTemplate: false,
      updatedAt: new Date().toISOString(),
    };

    let nextList: Diagram[];
    const existingIndex = diagrams.findIndex((d) => d.id === diagram.id);
    if (existingIndex >= 0) {
      nextList = [...diagrams];
      nextList[existingIndex] = updatedDiagram;
    } else {
      nextList = [updatedDiagram, ...diagrams];
    }

    localStorage.setItem(key, JSON.stringify(nextList));
    window.dispatchEvent(new CustomEvent('flowcraft:storage-update', { detail: { id: diagram.id } }));

    // Send to backend API (PUT with fallback to POST if not created yet),
    // tagging the request with the version we edited from.
    return fetch(`/api/diagrams/${diagram.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updatedDiagram, baseVersion }),
    })
      .then(async (res): Promise<SaveResult> => {
        if (res.status === 409) {
          const body = await res.json().catch(() => null);
          const latest = body?.latest as Diagram | undefined;
          if (!latest) return { status: 'error' };
          // Reconcile the local cache with the authoritative server copy so
          // we don't keep re-offering a stale version on next load.
          const list = getDiagrams(userId);
          const idx = list.findIndex((d) => d.id === latest.id);
          const merged =
            idx >= 0 ? [...list.slice(0, idx), latest, ...list.slice(idx + 1)] : [latest, ...list];
          localStorage.setItem(key, JSON.stringify(merged));
          return { status: 'conflict', latest };
        }
        if (res.status === 404) {
          const created = await fetch('/api/diagrams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedDiagram),
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null);
          return created ? { status: 'created', diagram: created } : { status: 'error' };
        }
        if (res.ok) {
          const saved = await res.json();
          return { status: 'ok', diagram: saved };
        }
        return { status: 'error' };
      })
      .catch((): SaveResult => ({ status: 'error' }));
  } catch (error) {
    console.error('Error saving diagram:', error);
    return Promise.resolve({ status: 'error' });
  }
}

// Fetches the authoritative current copy from the server, bypassing the
// local cache entirely. Used to detect drift while a diagram is open.
export async function fetchLatestFromServer(id: string): Promise<Diagram | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`/api/diagrams/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function createDiagram(
  params: {
    title: string;
    description?: string;
    category: DiagramCategory;
    tags?: string[];
    templateId?: string;
    gridType?: 'dots' | 'lines' | 'cross' | 'none';
    defaultEdgeType?: 'smoothstep' | 'bezier' | 'straight';
    nodes?: Diagram['nodes'];
    edges?: Diagram['edges'];
  },
  userId?: string | null
): Diagram {
  let initialNodes: Diagram['nodes'] = params.nodes || [];
  let initialEdges: Diagram['edges'] = params.edges || [];

  if (!params.nodes && params.templateId && params.templateId !== 'blank') {
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
    userId: userId || undefined,
    users: userId ? [{ userId, accesstype: 'ADMIN' }] : undefined,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDiagram(newDiagram, userId);

  // Immediately POST to backend API to ensure database persistence
  fetch('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newDiagram),
  }).catch(() => {});

  return newDiagram;
}

export function duplicateDiagram(id: string, userId?: string | null): Diagram | null {
  const source = getDiagram(id, userId);
  if (!source) return null;

  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cloned: Diagram = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    title: `${source.title} (Copy)`,
    userId: userId || undefined,
    users: userId ? [{ userId, accesstype: 'ADMIN' }] : undefined,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDiagram(cloned, userId);

  // Immediately POST to backend API
  fetch('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cloned),
  }).catch(() => {});

  return cloned;
}

export function deleteDiagram(id: string, userId?: string | null): boolean {
  if (typeof window === 'undefined') return false;

  // Cannot delete system sample templates
  if (id.startsWith('template-') || STARTER_TEMPLATES.some((t) => t.id === id)) {
    return false;
  }

  try {
    const key = getStorageKey(userId);
    const diagrams = getDiagrams(userId);
    const filtered = diagrams.filter((d) => d.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('flowcraft:storage-update', { detail: { id } }));

    // Delete from backend API
    fetch(`/api/diagrams/${id}`, { method: 'DELETE' }).catch(() => {});
    return true;
  } catch (error) {
    console.error('Error deleting diagram:', error);
    return false;
  }
}

export function exportDiagramJSON(id: string, userId?: string | null): string {
  const diagram = getDiagram(id, userId);
  if (!diagram) throw new Error('Diagram not found');
  return JSON.stringify(diagram, null, 2);
}

export function importDiagramJSON(jsonString: string, userId?: string | null): Diagram {
  const parsed = JSON.parse(jsonString);
  if (!parsed || !parsed.title || !Array.isArray(parsed.nodes)) {
    throw new Error('Invalid diagram JSON schema');
  }

  const newId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const imported: Diagram = {
    ...parsed,
    id: newId,
    title: `${parsed.title} (Imported)`,
    userId: userId || undefined,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveDiagram(imported, userId);

  // Immediately POST to backend API
  fetch('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(imported),
  }).catch(() => {});

  return imported;
}
