import { NextResponse } from 'next/server';
import { resolveAuthUserId } from '@/lib/auth';
import { revokeSession } from '@/lib/sessionStore';

export async function DELETE(request: Request, props: { params: Promise<{ jti: string }> }) {
  const { jti } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  // Scoped to the requesting user's own userId — there's no way to pass
  // someone else's userId here, so this can only ever revoke your own
  // sessions regardless of what jti is supplied.
  await revokeSession(userId, jti);
  return NextResponse.json({ success: true });
}
