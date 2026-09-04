import { NextResponse } from 'next/server';
import {
  getAuthCookies,
  verifyRefreshToken,
  generateAccessToken,
  setAccessTokenCookie,
  clearAuthCookies,
} from '@/lib/auth';
import { findUserById, sanitizeUser } from '@/lib/userStorage';

export async function POST(request: Request) {
  try {
    const cookies = await getAuthCookies();
    let refreshToken = cookies.refreshToken;

    // Optional: allow passing in body or Authorization header for mobile/API clients
    if (!refreshToken) {
      try {
        const body = await request.json();
        if (body.refreshToken) refreshToken = body.refreshToken;
      } catch {
        // body not provided
      }
    }

    if (!refreshToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        refreshToken = authHeader.substring(7);
      }
    }

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 401 });
    }

    // Verify refresh token signature and 28-day expiration
    const payload = verifyRefreshToken(refreshToken);
    if (!payload || !payload.userId) {
      await clearAuthCookies();
      return NextResponse.json({ error: 'Refresh token is expired or invalid' }, { status: 401 });
    }

    // Check user in database
    const user = await findUserById(payload.userId);
    if (!user || user.refreshToken !== refreshToken) {
      await clearAuthCookies();
      return NextResponse.json({ error: 'Session has been revoked or expired' }, { status: 401 });
    }

    // Strictly enforce isVerified
    if (user.isVerified !== true) {
      await clearAuthCookies();
      return NextResponse.json(
        { error: 'Your account is not verified. Please complete verification to sign in.', needsVerification: true },
        { status: 403 }
      );
    }

    // Generate new 1-Day Access Token
    const newAccessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });

    // Update access token cookie
    await setAccessTokenCookie(newAccessToken);

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: newAccessToken,
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh token' }, { status: 500 });
  }
}
