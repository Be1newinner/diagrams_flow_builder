import { NextResponse } from 'next/server';
import { getServerDiagrams, saveServerDiagram, getUserDiagramCount, MAX_DIAGRAMS_PER_USER } from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';
import { Diagram } from '@/types/diagram';

export async function GET(request: Request) {
  const userId = await resolveAuthUserId(request);
  const diagrams = await getServerDiagrams(userId);
  return NextResponse.json(diagrams);
}

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. You must be signed in to create and save diagrams.' },
        { status: 401 }
      );
    }

    const currentCount = await getUserDiagramCount(userId);
    if (currentCount >= MAX_DIAGRAMS_PER_USER) {
      return NextResponse.json(
        { error: `Diagram limit reached (${MAX_DIAGRAMS_PER_USER}/${MAX_DIAGRAMS_PER_USER}). Please delete older diagrams to create new ones.` },
        { status: 403 }
      );
    }

    const body: Diagram = await request.json();
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    body.userId = userId;
    body.isTemplate = false;

    const saved = await saveServerDiagram(body, userId);
    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create diagram' }, { status: 500 });
  }
}
