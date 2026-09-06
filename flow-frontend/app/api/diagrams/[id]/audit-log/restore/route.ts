import { NextResponse } from 'next/server';
import { restoreDiagramSnapshot } from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';

// ADMIN-only, matching the GET audit-log route this restores from.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { entryId } = await request.json();
  if (!entryId || typeof entryId !== 'string') {
    return NextResponse.json({ error: 'entryId is required.' }, { status: 400 });
  }

  try {
    const diagram = await restoreDiagramSnapshot(id, userId, entryId);
    return NextResponse.json(diagram);
  } catch (error: any) {
    const message = error?.message || 'Failed to restore version';
    const status = message.startsWith('Forbidden') ? 403 : message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
