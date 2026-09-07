import { NextResponse } from 'next/server';
import { renameServerFolder, deleteServerFolder } from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';
import { FolderColor } from '@/types/folder';

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Sign in to edit folders.' },
      { status: 401 }
    );
  }

  try {
    const body: { name?: string; color?: FolderColor } = await request.json();
    const updated = await renameServerFolder(id, userId, body);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update folder' }, { status: 400 });
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
      { error: 'Authentication required. Sign in to delete folders.' },
      { status: 401 }
    );
  }

  const success = await deleteServerFolder(id, userId);
  if (!success) {
    return NextResponse.json({ error: 'Folder not found or access denied' }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: 'Folder deleted' });
}
