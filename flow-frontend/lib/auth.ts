import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { AccessTokenPayload, RefreshTokenPayload } from '@/types/user';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'flowcraft_access_secret_super_secure_key_1d';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'flowcraft_refresh_secret_super_secure_key_28d';

// Token Expiry constants
export const ACCESS_TOKEN_EXPIRY = '1d'; // 1 Day
export const REFRESH_TOKEN_EXPIRY = '28d'; // 28 Days

export const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24; // 86,400 seconds (1 Day)
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 28; // 2,419,200 seconds (28 Days)

export const ACCESS_COOKIE_NAME = 'flow_access_token';
export const REFRESH_COOKIE_NAME = 'flow_refresh_token';

// Password Hashing with bcrypt
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Token Generation
export function generateAccessToken(user: { id: string; email: string; name: string }): string {
  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    type: 'access',
  };

  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(user: { id: string }): string {
  const payload: RefreshTokenPayload = {
    userId: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

// Long-lived MCP API Token for AI client integrations (1 Year validity)
export function generateMcpToken(user: { id: string; email: string; name: string }): string {
  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    type: 'access',
  };

  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: '365d',
  });
}

// Token Verification
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
    if (decoded.type !== 'access') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}

// Cookie Helpers for App Router
export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export async function setAccessTokenCookie(accessToken: string) {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';

  cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

export async function getAuthCookies(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(ACCESS_COOKIE_NAME)?.value,
    refreshToken: cookieStore.get(REFRESH_COOKIE_NAME)?.value,
  };
}

export async function resolveAuthUserId(request?: Request): Promise<string | null> {
  try {
    // 1. Check Authorization header
    if (request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyAccessToken(token);
        if (payload?.userId) return payload.userId;
      }

      // Check request Cookie header directly (crucial for fetch from client components)
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const matchAccess = cookieHeader.match(new RegExp(`${ACCESS_COOKIE_NAME}=([^;]+)`));
        if (matchAccess?.[1]) {
          const payload = verifyAccessToken(matchAccess[1]);
          if (payload?.userId) return payload.userId;
        }
        const matchRefresh = cookieHeader.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
        if (matchRefresh?.[1]) {
          const payload = verifyRefreshToken(matchRefresh[1]);
          if (payload?.userId) return payload.userId;
        }
      }
    }

    // 2. Check Next.js cookie store
    try {
      const authCookies = await getAuthCookies();
      if (authCookies.accessToken) {
        const payload = verifyAccessToken(authCookies.accessToken);
        if (payload?.userId) return payload.userId;
      }

      if (authCookies.refreshToken) {
        const payload = verifyRefreshToken(authCookies.refreshToken);
        if (payload?.userId) return payload.userId;
      }
    } catch {}

    return null;
  } catch {
    return null;
  }
}
