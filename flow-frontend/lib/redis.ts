import { Redis } from '@upstash/redis';

// Single shared Upstash client, reused by both rate limiting and diagram
// caching. Null when unconfigured (e.g. local dev without the env vars set)
// — every caller must treat that as "feature disabled," not throw.
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function isRedisConfigured(): boolean {
  return redis !== null;
}
