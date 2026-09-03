import { NextResponse } from 'next/server';
import { getServerDiagrams, saveServerDiagram } from '@/lib/serverStorage';
import { Diagram } from '@/types/diagram';

export async function GET() {
  const diagrams = await getServerDiagrams();
  return NextResponse.json(diagrams);
}

export async function POST(request: Request) {
  try {
    const body: Diagram = await request.json();
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const saved = await saveServerDiagram(body);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create diagram' }, { status: 500 });
  }
}
