import { redis, isRedisConfigured } from '@/lib/redis';

export interface AuditEntry {
  userId: string;
  action: 'created' | 'updated' | 'deleted';
  timestamp: string;
}

// Per-diagram activity feed: a capped Redis list, not a growing database
// table — this is meant as a lightweight "who touched this and when," not a
// full change-history/diff system. Granularity is intentionally coarse
// (created/updated/deleted, not "added node X" or "renamed title") because
// every write path (PUT route, POST route, every MCP tool handler) already
// funnels through one choke point in serverStorage.ts that only has the
// final document, not a diff against the previous one — capturing field-
// level changes would mean threading that comparison through every caller.
const MAX_ENTRIES = 100;
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — well past any diagram's normal edit cadence

function auditKey(diagramId: string): string {
  return `audit:${diagramId}`;
}

export async function logDiagramActivity(
  diagramId: string,
  userId: string,
  action: AuditEntry['action']
): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  const entry: AuditEntry = { userId, action, timestamp: new Date().toISOString() };
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
