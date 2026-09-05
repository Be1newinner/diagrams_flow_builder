import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  authLimiter,
  mcpLimiter,
  diagramWriteLimiter,
  generalApiLimiter,
  isRateLimitConfigured,
} from '@/lib/ratelimit';
import { resolveUserIdEdge } from '@/lib/edgeAuth';

// Endpoints where legitimate use is inherently rare (a human logging in or
// resetting a password doesn't retry more than a few times a minute) and
// abuse is the classic threat model (credential stuffing, spam signups).
// These stay IP-keyed even though every other bucket now prefers the
// authenticated user's id: there IS no valid identity yet at this point in
// the flow — that's exactly what these endpoints are proving — so "per
// user" isn't a meaningful concept here, only "per source."
const STRICT_AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/register-otp',
  '/api/auth/verify-register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function middleware(request: NextRequest) {
  // No Upstash credentials configured (e.g. local dev without them set) —
  // don't block anything, just skip straight through.
  if (!isRateLimitConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Prefer the authenticated user's id over IP wherever one is available:
  // it survives shared networks (office wifi, VPN, mobile carrier NAT)
  // correctly separating distinct legitimate users who'd otherwise share one
  // IP-keyed bucket. Falls back to IP for anonymous requests or an
  // unverifiable/expired token — this is purely a bucketing choice, never an
  // authorization decision, so a forged token can't grant anything: every
  // route handler still fully re-verifies via resolveAuthUserId itself.
  const actor = STRICT_AUTH_PATHS.has(pathname) ? null : await resolveUserIdEdge(request);
  const identifier = actor ? `user:${actor}` : `ip:${ip}`;

  let limiter = generalApiLimiter;
  let key = `general:${identifier}`;

  if (STRICT_AUTH_PATHS.has(pathname)) {
    limiter = authLimiter;
    key = `auth:${identifier}`;
  } else if (pathname === '/api/mcp') {
    limiter = mcpLimiter;
    key = `mcp:${identifier}`;
  } else if (
    request.method !== 'GET' &&
    (pathname === '/api/diagrams' || pathname.startsWith('/api/diagrams/'))
  ) {
    limiter = diagramWriteLimiter;
    key = `diagram-write:${identifier}`;
  }

  if (!limiter) {
    return NextResponse.next();
  }

  const { success, limit, remaining, reset } = await limiter.limit(key);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down and try again shortly.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
