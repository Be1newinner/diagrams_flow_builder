import { NextResponse } from 'next/server';
import { getServerDiagrams, getServerDiagram, saveServerDiagram, getUserDiagramCount, diagramExistsById, MAX_DIAGRAMS_PER_USER } from '@/lib/serverStorage';
import { resolveAuthUserId } from '@/lib/auth';
import { Diagram } from '@/types/diagram';

export async function GET(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. You must be signed in to view diagrams.' },
      { status: 401 }
    );
  }
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

    // A client-supplied id colliding with an existing diagram must be
    // rejected outright — getServerDiagram(id, userId) returns null for
    // BOTH "no such diagram" and "exists but you have no access", so
    // without this check that collision would silently fall through to
    // saveServerDiagram's create-new path and upsert over (overwrite) the
    // other diagram, making the caller its new owner. Reusing an id you
    // already own is still fine — that's just a normal update.
    if (body.id) {
      const existing = await getServerDiagram(body.id, userId);
      if (!existing && (await diagramExistsById(body.id))) {
        return NextResponse.json(
          { error: 'A diagram with this id already exists and you do not have access to it.' },
          { status: 409 }
        );
      }
    }

    body.id = body.id || `flow_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    body.userId = userId;
    body.isTemplate = false;

    const saved = await saveServerDiagram(body, userId);
    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create diagram' }, { status: 500 });
  }
}
