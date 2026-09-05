import { Ratelimit } from '@upstash/ratelimit';
import { redis, isRedisConfigured } from './redis';

// Rate limiting must live in a shared store, not per-process memory: Vercel
// runs many parallel serverless/edge instances, so an in-memory counter only
// ever sees a fraction of a client's traffic and is trivial to route around.
// Upstash's REST-based Redis client works natively in the Edge runtime
// (fetch-based, no Node APIs), which is what lets this run in middleware.ts
// ahead of every API route — including /api/mcp — so an abusive burst never
// even reaches a Node serverless function invocation.
export const isRateLimitConfigured = isRedisConfigured;

// Buckets tuned for a small user base (~20-30 people/month) sharing a
// ~1M/month Vercel invocation budget. Each is a sliding window keyed per
// client IP (see middleware.ts). Numbers are deliberately generous for
// normal interactive use — an active editing session, or a burst of MCP
// tool calls building out a diagram — and only bite on sustained, scripted
// hammering.

// Login/register/password-reset: classic brute-force/spam targets, and
// legitimate use is inherently low-frequency (a human retries a handful of
// times a minute at most).
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:auth',
      analytics: true,
    })
  : null;

// The MCP endpoint: a single tool-assisted session can legitimately fire
// dozens of calls in quick succession (e.g. building out a diagram node by
// node), so this stays generous — it's there to catch a runaway/looping
// client, not to throttle normal use.
export const mcpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      prefix: 'rl:mcp',
      analytics: true,
    })
  : null;

// Diagram create/update/delete: heavier (DB writes) than a read, so a
// tighter bucket than general reads, but still well above what autosave's
// 600ms debounce could ever produce from one real user.
export const diagramWriteLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      prefix: 'rl:diagram-write',
      analytics: true,
    })
  : null;

// Fallback for everything else under /api/* (reads, auth session checks,
// etc.) — generous, mainly a backstop against volumetric abuse.
export const generalApiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, '60 s'),
      prefix: 'rl:api',
      analytics: true,
    })
  : null;
