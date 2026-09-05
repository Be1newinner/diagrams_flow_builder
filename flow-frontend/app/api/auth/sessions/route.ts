import { NextResponse } from 'next/server';
import { resolveAuthUserId, getAuthCookies, verifyAccessToken, verifyRefreshToken } from '@/lib/auth';
import { listSessions } from '@/lib/sessionStore';

// Which of this user's active sessions belongs to the request making this
// call, so the UI can label it "This device" and disable revoking it from
// here (use Sign Out for that instead — revoking your own current session
// out from under yourself is a support headache, not a security win).
async function currentSessionJti(request: Request): Promise<string | undefined> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = verifyAccessToken(authHeader.substring(7));
    if (payload?.jti) return payload.jti;
  }
  const cookies = await getAuthCookies();
  if (cookies.accessToken) {
    const payload = verifyAccessToken(cookies.accessToken);
    if (payload?.jti) return payload.jti;
  }
  if (cookies.refreshToken) {
    const payload = verifyRefreshToken(cookies.refreshToken);
    if (payload?.jti) return payload.jti;
  }
  return undefined;
}

export async function GET(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const [sessions, currentJti] = await Promise.all([listSessions(userId), currentSessionJti(request)]);
  return NextResponse.json({ sessions, currentJti });
}
