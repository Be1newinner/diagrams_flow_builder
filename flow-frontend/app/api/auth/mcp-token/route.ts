import { NextResponse } from 'next/server';
import { getAuthCookies, verifyAccessToken, verifyRefreshToken, generateMcpToken } from '@/lib/auth';
import { findUserById, sanitizeUser } from '@/lib/userStorage';

export async function GET(request: Request) {
  try {
    const cookies = await getAuthCookies();
    let userId: string | null = null;

    if (cookies.accessToken) {
      const payload = verifyAccessToken(cookies.accessToken);
      if (payload?.userId) userId = payload.userId;
    }

    if (!userId && cookies.refreshToken) {
      const payload = verifyRefreshToken(cookies.refreshToken);
      if (payload?.userId) userId = payload.userId;
    }

    if (!userId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const payload = verifyAccessToken(authHeader.substring(7));
        if (payload?.userId) userId = payload.userId;
      }
    }

    if (!userId) {
      return NextResponse.json({
        success: false,
        token: null,
        message: 'Sign in to generate a personalized MCP API token',
      });
    }

    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, token: null, message: 'User not found' }, { status: 404 });
    }

    const mcpToken = generateMcpToken({ id: user.id, email: user.email, name: user.name });

    return NextResponse.json({
      success: true,
      token: mcpToken,
      user: sanitizeUser(user),
      expiresIn: '365 Days',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
