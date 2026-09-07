import { NextResponse } from 'next/server';
import { getServerFolders, createServerFolder } from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';
import { FolderColor } from '@/types/folder';

export async function GET(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. You must be signed in to view folders.' },
      { status: 401 }
    );
  }
  const folders = await getServerFolders(userId);
  return NextResponse.json(folders);
}

export async function POST(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. You must be signed in to create folders.' },
      { status: 401 }
    );
  }

  try {
    const body: { name?: string; color?: FolderColor } = await request.json();
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    const folder = await createServerFolder(userId, body.name, body.color);
    return NextResponse.json(folder, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create folder' }, { status: 400 });
  }
}
