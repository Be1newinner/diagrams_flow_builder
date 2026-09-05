import { redis, isRedisConfigured } from '@/lib/redis';

// Duplicated from lib/auth.ts's SESSION_TTL_SECONDS rather than imported,
// to avoid a circular import (lib/auth.ts also needs to call into this
// module, to check session validity in resolveAuthUserId). Keep in sync if
// the refresh token lifetime ever changes.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 28; // 28 days

export interface SessionRecord {
  jti: string;
  userAgent: string;
  ip: string;
  createdAt: string;
}

// Active-session tracking, so "sign out this device" is a real revocation
// instead of just a cosmetic list. This is deliberately an allowlist, not a
// denylist: a session is valid if and only if `session:{userId}:{jti}`
// exists in Redis. Revoking just deletes that one key; letting it expire
// naturally (TTL matches SESSION_TTL_SECONDS) handles cleanup for free
// without a separate sweep job.
//
// Only tokens minted at login carry a `jti` (see generateAccessToken /
// generateRefreshToken in lib/auth.ts) — the long-lived MCP token predates
// this and intentionally has no jti, so it's exempt from this check
// entirely (see resolveAuthUserId). This only ever adds a restriction on
// top of a valid JWT signature; it can't grant access a bad signature
// wouldn't already have been rejected for.
function sessionKey(userId: string, jti: string): string {
  return `session:${userId}:${jti}`;
}
function sessionIndexKey(userId: string): string {
  return `session-index:${userId}`;
}

export async function createSession(
  userId: string,
  jti: string,
  meta: { userAgent: string; ip: string }
): Promise<void> {
  if (!isRedisConfigured() || !redis) return; // no Redis configured: sessions simply aren't tracked/enforced
  const record: SessionRecord = { jti, userAgent: meta.userAgent, ip: meta.ip, createdAt: new Date().toISOString() };
  try {
    await redis.set(sessionKey(userId, jti), record, { ex: SESSION_TTL_SECONDS });
    await redis.sadd(sessionIndexKey(userId), jti);
    await redis.expire(sessionIndexKey(userId), SESSION_TTL_SECONDS);
  } catch (err) {
    console.error('[Redis Error] createSession:', err);
  }
}

// Fails OPEN (returns true) when Redis is unreachable or unconfigured — a
// revocation feature going down should degrade to "can't revoke right now,"
// not "nobody can use the app." Real access control (password, JWT
// signature/expiry) is unaffected either way.
export async function isSessionActive(userId: string, jti: string): Promise<boolean> {
  if (!isRedisConfigured() || !redis) return true;
  try {
    const record = await redis.get(sessionKey(userId, jti));
    return record !== null;
  } catch (err) {
    console.error('[Redis Error] isSessionActive:', err);
    return true;
  }
}

export async function listSessions(userId: string): Promise<SessionRecord[]> {
  if (!isRedisConfigured() || !redis) return [];
  try {
    const jtis = await redis.smembers(sessionIndexKey(userId));
    if (jtis.length === 0) return [];
    const records = await Promise.all(jtis.map((jti) => redis!.get<SessionRecord>(sessionKey(userId, jti))));
    const active = records.filter((r): r is SessionRecord => r !== null);
    // Prune index entries whose underlying session key already expired,
    // so the index doesn't grow stale forever.
    const staleJtis = jtis.filter((_, i) => records[i] === null);
    if (staleJtis.length > 0) {
      await redis.srem(sessionIndexKey(userId), ...staleJtis);
    }
    return active.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('[Redis Error] listSessions:', err);
    return [];
  }
}

export async function revokeSession(userId: string, jti: string): Promise<void> {
  if (!isRedisConfigured() || !redis) return;
  try {
    await redis.del(sessionKey(userId, jti));
    await redis.srem(sessionIndexKey(userId), jti);
  } catch (err) {
    console.error('[Redis Error] revokeSession:', err);
  }
}
