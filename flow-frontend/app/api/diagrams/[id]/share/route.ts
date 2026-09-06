import { NextResponse } from 'next/server';
import {
  getServerDiagram,
  shareDiagramWithUser,
  revokeDiagramAccess,
  setDiagramPublic,
} from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';
import { findUserByEmail, findUserById } from '@/lib/userStorage';
import { sendShareEmail } from '@/lib/mailer';

// Returns the current sharing state (viewer list with names/emails, and the
// public-viewer flag) so the Share modal can render it. ADMIN-only, same as
// every other mutation below — viewers should not learn who else can see
// a diagram they don't own.
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const diagram = await getServerDiagram(id, userId);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }

  const isAdmin =
    diagram.userId === userId ||
    diagram.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN');
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Only the diagram ADMIN can view sharing settings.' },
      { status: 403 }
    );
  }

  const viewerIds = (diagram.users || []).filter((u) => u.accesstype === 'VIEWER').map((u) => u.userId);
  const viewers = await Promise.all(
    viewerIds.map(async (vid) => {
      const u = await findUserById(vid);
      return { userId: vid, name: u?.name || 'Unknown user', email: u?.email || '' };
    })
  );

  return NextResponse.json({ isPublic: diagram.isPublic === true, viewers });
}

// Invite a user to view this diagram by email — adds them as VIEWER and
// emails them a link. Deliberately requires the invitee to already have a
// FlowCraft account (found via findUserByEmail) rather than accepting any
// arbitrary email, so `users[]` never ends up referencing a userId that
// doesn't exist.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let email: string;
  try {
    const body = await request.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const invitee = await findUserByEmail(email);
  if (!invitee) {
    return NextResponse.json(
      { error: 'No FlowCraft account found for that email address.' },
      { status: 404 }
    );
  }

  const admin = await findUserById(userId);

  try {
    const updated = await shareDiagramWithUser(id, userId, invitee.id);

    const origin = new URL(request.url).origin;
    const diagramUrl = `${origin}/flow/${id}`;
    // Best-effort: sharing access has already been granted above regardless
    // of whether the notification email succeeds, so a transient mail
    // failure doesn't leave the invitee silently un-notified but stuck.
    try {
      await sendShareEmail({
        to: invitee.email,
        diagramTitle: updated.title,
        diagramUrl,
        sharedByName: admin?.name || 'A FlowCraft user',
      });
    } catch (mailErr) {
      console.error('[Share] Failed to send invite email:', mailErr);
    }

    return NextResponse.json({ success: true, diagram: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to share diagram';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// Toggle "share with everyone" (any signed-in user gets read-only access).
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let isPublic: boolean;
  try {
    const body = await request.json();
    isPublic = body.isPublic === true;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const updated = await setDiagramPublic(id, userId, isPublic);
    return NextResponse.json({ success: true, diagram: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update sharing settings';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// Revoke a previously shared viewer's access.
export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const targetUserId = new URL(request.url).searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId query parameter is required.' }, { status: 400 });
  }

  try {
    const updated = await revokeDiagramAccess(id, userId, targetUserId);
    return NextResponse.json({ success: true, diagram: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke access';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
