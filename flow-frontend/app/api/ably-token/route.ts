import { NextResponse } from 'next/server';
import Ably from 'ably';
import { resolveAuthUserId } from '@/lib/auth';
import { getServerDiagram } from '@/lib/serverStorage';
import { diagramChannelName } from '@/lib/ably';

// Ably's client SDK is pointed at this route via `authUrl`. It must return a
// signed TokenRequest (not the raw API key) so the root key never reaches
// the browser. clientId is set to our own userId so presence/auth on the
// Ably side always maps back to an authenticated app user.
//
// The client sends `diagramId` (via authParams — see the Realtime() call in
// app/flow/[id]/page.tsx) so the token can be scoped with an explicit
// `capability` to just that one diagram's channel. Without this, an
// unscoped token (Ably's default when `capability` is omitted) can
// subscribe to *every* channel under this API key — i.e. any logged-in
// user could listen to every other diagram's update events. The leak was
// minimal (a bare {updatedAt} timestamp, never diagram content), but this
// closes it properly rather than relying on that being harmless.
export async function GET(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const key = process.env.ABLY_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Realtime updates are not configured.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const diagramId = searchParams.get('diagramId');
  if (!diagramId) {
    return NextResponse.json({ error: 'diagramId is required.' }, { status: 400 });
  }

  // Reuses the exact same ADMIN/VIEWER/template access check every other
  // diagram read goes through (and benefits from the same Redis cache) —
  // no separate authorization logic to keep in sync.
  const diagram = await getServerDiagram(diagramId, userId);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found or access denied.' }, { status: 403 });
  }

  try {
    const client = new Ably.Rest({ key });
    const tokenRequest = await client.auth.createTokenRequest({
      clientId: userId,
      capability: {
        // 'presence' lets the client enter/update/leave and read the
        // presence set (who else is viewing) — needed for the "who's here"
        // indicator and live collaborator cursors, both scoped to this same
        // one channel.
        [diagramChannelName(diagramId)]: ['subscribe', 'presence'],
      },
    });
    return NextResponse.json(tokenRequest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create Ably token' }, { status: 500 });
  }
}
