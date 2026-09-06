import { Node, Edge } from '@/types/diagram';

// Undo/redo is purely a local-session concern — it has nothing to do with
// the server's activity/version history (lib/auditLog.ts), which is a
// deliberately coarse, shared, DB-backed feed for "who changed what."  This
// stack is per-browser, per-diagram, and never leaves localStorage, so a
// page refresh doesn't wipe out the ability to undo what you just did.

export interface UndoSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface UndoStack {
  history: UndoSnapshot[];
  future: UndoSnapshot[];
}

function storageKey(diagramId: string): string {
  // Deliberately NOT prefixed `flowcraft_diagrams*` — lib/storage.ts purges
  // every key with that prefix on load to kill a stale-diagram-content bug.
  // This holds no diagram content of record, just an undo stack, so it must
  // survive that purge.
  return `flowcraft_undo_${diagramId}`;
}

export function loadUndoStack(diagramId: string): UndoStack {
  if (typeof window === 'undefined') return { history: [], future: [] };
  try {
    const raw = localStorage.getItem(storageKey(diagramId));
    if (!raw) return { history: [], future: [] };
    const parsed = JSON.parse(raw);
    return {
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      future: Array.isArray(parsed?.future) ? parsed.future : [],
    };
  } catch {
    return { history: [], future: [] };
  }
}

export function saveUndoStack(diagramId: string, stack: UndoStack): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(diagramId), JSON.stringify(stack));
  } catch {
    // Quota exceeded or storage unavailable (private browsing, etc.) — undo
    // still works for the rest of this session via React state, it just
    // won't survive a refresh. Not worth surfacing to the user.
  }
}

export function clearUndoStack(diagramId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(diagramId));
  } catch {}
}
