import { NextResponse } from 'next/server';
import {
  getAuthCookies,
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  setAccessTokenCookie,
} from '@/lib/auth';
import { findUserById, sanitizeUser } from '@/lib/userStorage';

export async function GET(request: Request) {
  try {
    const cookies = await getAuthCookies();
    let accessToken = cookies.accessToken;

    if (!accessToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }

    // 1. Check Access Token (valid 1 day)
    if (accessToken) {
      const payload = verifyAccessToken(accessToken);
      if (payload && payload.userId) {
        const user = await findUserById(payload.userId);
        if (user) {
          return NextResponse.json({
            success: true,
            user: sanitizeUser(user),
          });
        }
      }
    }

    // 2. Access token missing or expired - check Refresh Token (valid 28 days)
    const refreshToken = cookies.refreshToken;
    if (refreshToken) {
      const refreshPayload = verifyRefreshToken(refreshToken);
      if (refreshPayload && refreshPayload.userId) {
        const user = await findUserById(refreshPayload.userId);
        if (user && user.refreshToken === refreshToken) {
          // Auto-renew 1-day access token seamlessly
          const newAccessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
          await setAccessTokenCookie(newAccessToken);

          return NextResponse.json({
            success: true,
            user: sanitizeUser(user),
            refreshed: true,
          });
        }
      }
    }

    return NextResponse.json({
      success: false,
      user: null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, user: null, error: error.message }, { status: 500 });
  }
}
