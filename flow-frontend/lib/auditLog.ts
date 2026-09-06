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

function auditKey(diagramId: string): string {
  return `audit:${diagramId}`;
}

export async function logDiagramActivity(
  diagramId: string,
  userId: string,
  action: AuditEntry['action'],
  actorType: AuditEntry['actorType'] = 'human',
  snapshot?: AuditSnapshot
): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  const entry: AuditEntry = {
    id: randomUUID(),
    userId,
    actorType,
    action,
    timestamp: new Date().toISOString(),
    ...(snapshot ? { snapshot } : {}),
  };
  try {
    const key = auditKey(diagramId);
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
