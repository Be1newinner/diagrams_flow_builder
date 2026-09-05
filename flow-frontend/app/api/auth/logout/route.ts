import { NextResponse } from 'next/server';
import { getAuthCookies, clearAuthCookies, verifyRefreshToken, verifyAccessToken } from '@/lib/auth';
import { updateUserRefreshToken } from '@/lib/userStorage';
import { revokeSession } from '@/lib/sessionStore';

export async function POST(request: Request) {
  try {
    const cookies = await getAuthCookies();
    let userId: string | null = null;
    let jti: string | undefined;

    if (cookies.refreshToken) {
      const payload = verifyRefreshToken(cookies.refreshToken);
      if (payload) {
        userId = payload.userId;
        jti = payload.jti;
      }
    }

    if (!userId && cookies.accessToken) {
      const payload = verifyAccessToken(cookies.accessToken);
      if (payload) {
        userId = payload.userId;
        jti = payload.jti;
      }
    }

    // Revoke this device's session (if it has one) and the legacy
    // single-refresh-token field, so both old and new checks agree this
    // device is signed out.
    if (userId) {
      await updateUserRefreshToken(userId, null);
      if (jti) await revokeSession(userId, jti);
    }

    // Clear both access and refresh cookies
    await clearAuthCookies();

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    await clearAuthCookies();
    return NextResponse.json({ success: true, message: 'Logged out' });
  }
}
