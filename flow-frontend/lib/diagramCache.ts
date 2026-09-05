import { redis, isRedisConfigured } from '@/lib/redis';
import { Diagram } from '@/types/diagram';

// Write-through cache for diagram documents, sitting in front of Mongo/file
// storage. getServerDiagram is on the hot path — every flow page load, every
// PUT's pre-fetch, every drift-detection poll from an open tab, and every
// MCP tool call — so caching it cuts most of that DB traffic for a small
// (~20-30 user) install where the same handful of diagrams get read far
// more often than they're written.
//
// This caches the RAW document only, with no access-control applied — the
// caller (getServerDiagram) still runs the exact same ADMIN/VIEWER/template
// check against the cached copy that it would against a fresh Mongo read.
// Caching never substitutes for that check, only for the fetch before it.
//
// TTL is a defense-in-depth backstop, not the primary correctness
// mechanism: saveServerDiagram/deleteServerDiagram explicitly update or
// clear this cache the moment they write, so reads should almost always see
// a value that's already fresh rather than waiting out the TTL.
const CACHE_TTL_SECONDS = 300;

function diagramCacheKey(id: string): string {
  return `diagram:${id}`;
}

export async function getCachedDiagram(id: string): Promise<Diagram | null> {
  if (!isRedisConfigured() || !redis) return null;
  try {
    return await redis.get<Diagram>(diagramCacheKey(id));
  } catch (err) {
    console.error('[Redis Error] getCachedDiagram:', err);
    return null;
  }
}

export async function setCachedDiagram(diagram: Diagram): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.set(diagramCacheKey(diagram.id), diagram, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('[Redis Error] setCachedDiagram:', err);
  }
}

export async function deleteCachedDiagram(id: string): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.del(diagramCacheKey(id));
  } catch (err) {
    console.error('[Redis Error] deleteCachedDiagram:', err);
  }
}

// The dashboard's "list my diagrams" view. Lower value than single-diagram
// caching above (it's loaded on dashboard visits, not polled repeatedly),
// so this is invalidate-on-write rather than write-through: simpler, and
// the next list fetch just rebuilds from Mongo/file once. Only invalidates
// the ADMIN's own cached list on a save/delete — a VIEWER who's been shared
// a diagram may see it in their list up to TTL_SECONDS stale, which is an
// acceptable trade-off given sharing isn't the primary use case here.
function diagramListCacheKey(userId: string): string {
  return `diagrams:list:${userId}`;
}

export async function getCachedDiagramList(userId: string): Promise<Diagram[] | null> {
  if (!isRedisConfigured() || !redis) return null;
  try {
    return await redis.get<Diagram[]>(diagramListCacheKey(userId));
  } catch (err) {
    console.error('[Redis Error] getCachedDiagramList:', err);
    return null;
  }
}

export async function setCachedDiagramList(userId: string, diagrams: Diagram[]): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.set(diagramListCacheKey(userId), diagrams, { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('[Redis Error] setCachedDiagramList:', err);
  }
}

export async function invalidateDiagramListCache(userId: string): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.del(diagramListCacheKey(userId));
  } catch (err) {
    console.error('[Redis Error] invalidateDiagramListCache:', err);
  }
}
