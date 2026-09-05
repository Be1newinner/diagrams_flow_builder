import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

// A second, Edge-runtime-safe way to read "who is this" for middleware.ts.
// lib/auth.ts can't be imported here: it pulls in `jsonwebtoken`, which uses
// Node's crypto module and isn't available on the Edge runtime middleware
// runs on. `jose` is the Edge-compatible equivalent. This intentionally
// duplicates just the cookie name + secret + payload shape from lib/auth.ts
// rather than sharing code — keep them in sync if either changes.
const ACCESS_COOKIE_NAME = 'flow_access_token';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'flowcraft_access_secret_super_secure_key_1d';

let cachedKey: Uint8Array | null = null;
function getKey(): Uint8Array {
  if (!cachedKey) {
    cachedKey = new TextEncoder().encode(ACCESS_SECRET);
  }
  return cachedKey;
}

// This is used ONLY to pick a rate-limit bucket key — never for
// authorization. A forged or expired token simply falls back to IP-based
// limiting (see middleware.ts); it can never grant access to anything, since
// every route handler still does its own full verification via
// resolveAuthUserId in lib/auth.ts regardless of what middleware decided.
export async function resolveUserIdEdge(request: NextRequest): Promise<string | null> {
  try {
    let token: string | undefined;

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, getKey());
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}
