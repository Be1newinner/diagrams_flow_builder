import { Diagram, DiagramCategory } from '@/types/diagram';
import { STARTER_TEMPLATES } from './templates';

// This module used to keep a client-side localStorage cache of diagrams,
// synced opportunistically with the server. That cache was the root cause
// of the "edits disappear" bug: a browser tab could hold a stale copy in
// localStorage/memory and autosave it back over a newer server-side edit
// (another tab, another user, or an MCP tool call), because the cache had
// no way to know it was stale. Diagrams are now read from and written to
// the server on every operation — no client-side cache, no cross-tab
// storage events, nothing to go stale.

// One-time cleanup: purge any leftover cache from before this change so an
// old tab can't resurrect stale data after a reload.
if (typeof window !== 'undefined') {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('flowcraft_diagrams')) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
}

async function apiFetch<T>(input: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(input, init);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data as T | null };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function getDiagrams(userId?: string | null): Promise<Diagram[]> {
  // Unauthenticated guests see ONLY the 3 starter sample templates
  if (!userId) return STARTER_TEMPLATES;

  const { ok, data } = await apiFetch<Diagram[]>('/api/diagrams');
  return ok && Array.isArray(data) ? data : STARTER_TEMPLATES;
}

export async function getDiagram(id: string): Promise<Diagram | null> {
  // Starter templates are static, bundled constants — not a cache of
  // anything server-side, so no fetch is needed for them.
  const template = STARTER_TEMPLATES.find((t) => t.id === id);
  if (template) return template;

  // No early bail-out for a missing userId: a diagram shared with "everyone
  // can view" must load for a fully anonymous visitor too. The API route
  // (and getServerDiagram/withAccessCheck behind it) is what actually
  // decides — it returns the diagram for a public one and 404s otherwise,
  // same as it always has for a signed-in user without access.
  const { ok, data } = await apiFetch<Diagram>(`/api/diagrams/${id}`);
  return ok ? data : null;
}

export type SaveResult =
  | { status: 'ok'; diagram: Diagram }
  | { status: 'created'; diagram: Diagram }
  | { status: 'conflict'; latest: Diagram }
  | { status: 'error' };

// Saves directly to the server, using optimistic concurrency:
// `diagram.updatedAt` as passed in is the version this edit was based on
// ("baseVersion"). If the server's copy has moved on since then — another
// tab, another user, or an MCP tool call saved in between — the server
// rejects with 409 instead of letting last-write-wins silently clobber
// that other edit. Callers should inspect the returned SaveResult.
// `checkpoint` controls whether this save gets its own activity/version
// entry or can be merged into the previous one (see logDiagramActivity in
// lib/auditLog.ts) — pass `false` only for a debounced autosave; leave the
// default `true` for a deliberate save (the "Save this version" button, or
// the initial save of a new diagram).
export function saveDiagram(diagram: Diagram, userId?: string | null, checkpoint: boolean = true): Promise<SaveResult> {
  // Cannot modify built-in starter templates
  if (diagram.isTemplate || diagram.id.startsWith('template-')) {
    return Promise.resolve({ status: 'error' });
  }

  const baseVersion = diagram.updatedAt;
  const payload: Diagram = {
    ...diagram,
    userId: userId || diagram.userId || undefined,
    users:
      diagram.users && diagram.users.length > 0
        ? diagram.users
        : userId
        ? [{ userId, accesstype: 'ADMIN' }]
        : undefined,
    isTemplate: false,
  };

  return fetch(`/api/diagrams/${diagram.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, baseVersion, checkpoint }),
  })
    .then(async (res): Promise<SaveResult> => {
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        const latest = body?.latest as Diagram | undefined;
        return latest ? { status: 'conflict', latest } : { status: 'error' };
      }
      if (res.status === 404) {
        const created = await fetch('/api/diagrams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
}

// Lightweight sibling of saveDiagram for viewers: canComment is a lower bar
// than canEdit (see the note on the client), so a plain viewer's comment
// add/reply/resolve must not go through the full-diagram PUT, which the
// server rejects for non-editors. Sending only `comments` in the body is
// what the server recognizes as a comment-only edit and allows regardless
// of edit permission.
export function saveDiagramComments(
  diagramId: string,
  comments: Diagram['comments'],
  baseVersion: string
): Promise<SaveResult> {
  return fetch(`/api/diagrams/${diagramId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comments, baseVersion }),
  })
    .then(async (res): Promise<SaveResult> => {
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        const latest = body?.latest as Diagram | undefined;
        return latest ? { status: 'conflict', latest } : { status: 'error' };
      }
      if (res.ok) {
        const saved = await res.json();
        return { status: 'ok', diagram: saved };
      }
      return { status: 'error' };
    })
    .catch((): SaveResult => ({ status: 'error' }));
}

// Fetches the authoritative current copy from the server. Used to detect
// drift while a diagram is open (see the polling effect in FlowEditorCanvas).
export async function fetchLatestFromServer(id: string): Promise<Diagram | null> {
  const { ok, data } = await apiFetch<Diagram>(`/api/diagrams/${id}`);
  return ok ? data : null;
}

export async function createDiagram(
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
): Promise<Diagram | null> {
  let initialNodes: Diagram['nodes'] = params.nodes || [];
  let initialEdges: Diagram['edges'] = params.edges || [];

  if (!params.nodes && params.templateId && params.templateId !== 'blank') {
    const template = STARTER_TEMPLATES.find((t) => t.id === params.templateId);
    if (template) {
      initialNodes = JSON.parse(JSON.stringify(template.nodes));
      initialEdges = JSON.parse(JSON.stringify(template.edges));
    }
  }

  const newDiagram: Partial<Diagram> = {
    id: `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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

  const { ok, data } = await apiFetch<Diagram>('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newDiagram),
  });
  return ok ? data : null;
}

export async function duplicateDiagram(id: string, userId?: string | null): Promise<Diagram | null> {
  const source = await getDiagram(id);
  if (!source) return null;

  const cloned: Diagram = {
    ...JSON.parse(JSON.stringify(source)),
    id: `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: `${source.title} (Copy)`,
    userId: userId || undefined,
    users: userId ? [{ userId, accesstype: 'ADMIN' }] : undefined,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { ok, data } = await apiFetch<Diagram>('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cloned),
  });
  return ok ? data : null;
}

// Note: no userId param — the server resolves the acting user from the
// session cookie and enforces ADMIN-only deletion itself.
export async function deleteDiagram(id: string): Promise<boolean> {
  // Cannot delete system sample templates
  if (id.startsWith('template-') || STARTER_TEMPLATES.some((t) => t.id === id)) {
    return false;
  }

  const { ok } = await apiFetch(`/api/diagrams/${id}`, { method: 'DELETE' });
  return ok;
}

export async function exportDiagramJSON(id: string): Promise<string> {
  const diagram = await getDiagram(id);
  if (!diagram) throw new Error('Diagram not found');
  return JSON.stringify(diagram, null, 2);
}

export async function importDiagramJSON(jsonString: string, userId?: string | null): Promise<Diagram> {
  const parsed = JSON.parse(jsonString);
  if (!parsed || !parsed.title || !Array.isArray(parsed.nodes)) {
    throw new Error('Invalid diagram JSON schema');
  }

  const imported: Diagram = {
    ...parsed,
    id: `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: `${parsed.title} (Imported)`,
    userId: userId || undefined,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { ok, data } = await apiFetch<Diagram>('/api/diagrams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(imported),
  });
  if (!ok || !data) throw new Error('Failed to import diagram');
  return data;
}
