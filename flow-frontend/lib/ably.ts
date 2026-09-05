import Ably from 'ably';

// Server-side singleton. ABLY_API_KEY is the secret root key from the Ably
// dashboard — never exposed to the browser. Clients authenticate against
// /api/ably-token instead, which mints short-lived token requests using
// this same key.
let restClient: Ably.Rest | null = null;

function getAblyRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  if (!restClient) {
    restClient = new Ably.Rest({ key });
  }
  return restClient;
}

export function diagramChannelName(diagramId: string): string {
  return `diagram:${diagramId}`;
}

// Fire-and-forget notification that a diagram changed. Called right after a
// successful write so every other open tab/session can react immediately
// instead of polling. Deliberately never throws — a notification failure
// should never fail the save itself; the drift-detection fallback (a slow
// background poll, or just a manual reload) covers the gap if this is down
// or ABLY_API_KEY isn't configured.
export async function publishDiagramUpdate(diagramId: string, updatedAt: string): Promise<void> {
  const client = getAblyRest();
  if (!client) return;
  try {
    await client.channels.get(diagramChannelName(diagramId)).publish('updated', { updatedAt });
  } catch (err) {
    console.error('[Ably] Failed to publish diagram update:', err);
  }
}

export function isAblyConfigured(): boolean {
  return !!process.env.ABLY_API_KEY;
}
