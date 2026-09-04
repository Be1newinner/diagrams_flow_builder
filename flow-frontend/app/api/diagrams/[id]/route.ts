import { NextResponse } from 'next/server';
import { getServerDiagram, saveServerDiagram, deleteServerDiagram } from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';
import { Diagram } from '@/types/diagram';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. You must be signed in to view diagrams.' },
      { status: 401 }
    );
  }

  const diagram = await getServerDiagram(id, userId);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }
  return NextResponse.json(diagram);
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Sign in to edit diagrams.' },
      { status: 401 }
    );
  }

  const existing = await getServerDiagram(id, userId);
  if (!existing) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }

  // Prevent modifying built-in sample templates
  if (existing.isTemplate || existing.id.startsWith('template-')) {
    return NextResponse.json(
      { error: 'Cannot modify built-in sample templates. Duplicate to your account to edit.' },
      { status: 403 }
    );
  }

  // Ensure user is ADMIN of this diagram
  const isAdmin =
    existing.userId === userId ||
    existing.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN');

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Only the diagram ADMIN can edit this diagram.' },
      { status: 403 }
    );
  }

  try {
    const body: Partial<Diagram> = await request.json();
    const updated: Diagram = {
      ...existing,
      ...body,
      id,
      userId,
      isTemplate: false,
    };
    const saved = await saveServerDiagram(updated, userId);
    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update diagram' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Sign in to delete diagrams.' },
      { status: 401 }
    );
  }

  // Prevent deleting system sample templates
  if (id.startsWith('template-')) {
    return NextResponse.json(
      { error: 'Cannot delete built-in sample templates.' },
      { status: 403 }
    );
  }

  const existing = await getServerDiagram(id, userId);
  if (!existing) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }

  if (existing.isTemplate) {
    return NextResponse.json(
      { error: 'Cannot delete built-in sample templates.' },
      { status: 403 }
    );
  }

  // Ensure user is ADMIN of this diagram
  const isAdmin =
    existing.userId === userId ||
    existing.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN');

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Only the diagram ADMIN can delete this diagram.' },
      { status: 403 }
    );
  }

  const success = await deleteServerDiagram(id, userId);
  if (!success) {
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
  return NextResponse.json({ success: true, message: 'Diagram deleted' });
}
