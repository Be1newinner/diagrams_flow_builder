import { NextResponse } from 'next/server';
import Ably from 'ably';
import { resolveAuthUserId } from '@/lib/auth';

// Ably's client SDK is pointed at this route via `authUrl`. It must return a
// signed TokenRequest (not the raw API key) so the root key never reaches
// the browser. clientId is set to our own userId so presence/auth on the
// Ably side always maps back to an authenticated app user.
export async function GET(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const key = process.env.ABLY_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Realtime updates are not configured.' }, { status: 503 });
  }

  try {
    const client = new Ably.Rest({ key });
    const tokenRequest = await client.auth.createTokenRequest({ clientId: userId });
    return NextResponse.json(tokenRequest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create Ably token' }, { status: 500 });
  }
}
