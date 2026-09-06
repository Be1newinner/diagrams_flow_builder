import { randomUUID } from 'crypto';
import type { Node, Edge } from '@xyflow/react';
import { redis, isRedisConfigured } from '@/lib/redis';

export interface AuditSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface AuditEntry {
  id: string;
  userId: string;
  actorType: 'human' | 'mcp';
  action: 'created' | 'updated' | 'deleted';
  timestamp: string;
  description: string;
  // False for a debounced autosave — makes it eligible to be coalesced into
  // (rather than pushed alongside) the previous entry, see logDiagramActivity
  // below. True for anything the user or an MCP tool did deliberately
  // (manual save, diagram creation, a restore, an MCP tool call).
  checkpoint: boolean;
  // Omitted for 'deleted' entries — there's nothing to restore back to.
  snapshot?: AuditSnapshot;
}

// Per-diagram activity feed: a capped Redis list, not a growing database
// table. Each entry also carries a full nodes/edges snapshot so an entry can
// be restored (time-travel) — every write path (PUT route, POST route,
// every MCP tool handler) already funnels through one choke point in
// serverStorage.ts that has the final document in hand right where activity
// is logged, so capturing it here costs nothing extra upstream.
const MAX_ENTRIES = 100;
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — well past any diagram's normal edit cadence

// A run of debounced autosaves from the same user within this window merges
// into a single entry instead of each pause-in-typing minting its own
// snapshot — a minute of dragging nodes around would otherwise burn through
// the 100-entry cap on near-identical rows. A deliberate action (manual
// save, MCP tool call, restore, diagram creation) always starts a fresh
// entry regardless of this window.
const COALESCE_WINDOW_MS = 5 * 60 * 1000;

function auditKey(diagramId: string): string {
  return `audit:${diagramId}`;
}

export async function logDiagramActivity(
  diagramId: string,
  userId: string,
  action: AuditEntry['action'],
  actorType: AuditEntry['actorType'] = 'human',
  snapshot: AuditSnapshot | undefined,
  description: string,
  checkpoint: boolean = true
): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  const key = auditKey(diagramId);
  const timestamp = new Date().toISOString();

  try {
    if (!checkpoint && action === 'updated') {
      const head = (await redis.lindex(key, 0)) as AuditEntry | null;
      if (
        head &&
        !head.checkpoint &&
        head.userId === userId &&
        head.actorType === actorType &&
        Date.now() - new Date(head.timestamp).getTime() < COALESCE_WINDOW_MS
      ) {
        const merged: AuditEntry = { ...head, timestamp, description, snapshot };
        await redis.lset(key, 0, merged);
        await redis.expire(key, TTL_SECONDS);
        return;
      }
    }

    const entry: AuditEntry = {
      id: randomUUID(),
      userId,
      actorType,
      action,
      timestamp,
      description,
      checkpoint,
      ...(snapshot ? { snapshot } : {}),
    };
    await redis.lpush(key, entry);
    await redis.ltrim(key, 0, MAX_ENTRIES - 1);
    await redis.expire(key, TTL_SECONDS);
  } catch (err) {
    console.error('[Redis Error] logDiagramActivity:', err);
  }
}

// Called when a diagram is deleted — nobody can view its activity log
// through the UI once the diagram itself is gone (the route that serves it
// checks the diagram still exists first), so there's no reason to let it
// sit around for the full TTL.
export async function deleteDiagramActivity(diagramId: string): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.del(auditKey(diagramId));
  } catch (err) {
    console.error('[Redis Error] deleteDiagramActivity:', err);
  }
}

export async function getDiagramActivity(diagramId: string): Promise<AuditEntry[]> {
  if (!isRedisConfigured() || !redis) return [];
  try {
    return await redis.lrange<AuditEntry>(auditKey(diagramId), 0, MAX_ENTRIES - 1);
  } catch (err) {
    console.error('[Redis Error] getDiagramActivity:', err);
    return [];
  }
}
