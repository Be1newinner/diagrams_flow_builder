import { NextResponse } from 'next/server';
import { getServerDiagram, saveServerDiagram, deleteServerDiagram } from '@/lib/serverStorage';
import { Diagram } from '@/types/diagram';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const diagram = await getServerDiagram(id);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
  }
  return NextResponse.json(diagram);
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const existing = await getServerDiagram(id);
  if (!existing) {
    return NextResponse.json({ error: 'Diagram not found' }, { status: 404 });
  }

  try {
    const body: Partial<Diagram> = await request.json();
    const updated: Diagram = {
      ...existing,
      ...body,
      id,
    };
    const saved = await saveServerDiagram(updated);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update diagram' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const success = await deleteServerDiagram(id);
  if (!success) {
    return NextResponse.json({ error: 'Diagram not found or deletion failed' }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: 'Diagram deleted' });
}
