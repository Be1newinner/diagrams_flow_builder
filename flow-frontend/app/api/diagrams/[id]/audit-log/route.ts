import { NextResponse } from 'next/server';
import { getServerDiagram } from '@/lib/serverStorage';
import { getDiagramActivity } from '@/lib/auditLog';
import { resolveAuthUserId } from '@/lib/auth';

// ADMIN-only, matching every other destructive/sensitive diagram action
// (eject nodes, disconnect edges, delete) — a VIEWER can see the diagram
// but not who's been changing it.
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const diagram = await getServerDiagram(id, userId);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found or access denied.' }, { status: 404 });
  }

  const isAdmin = diagram.userId === userId || diagram.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN');
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Only the diagram ADMIN can view its activity log.' }, { status: 403 });
  }

  const activity = await getDiagramActivity(id);
  return NextResponse.json({ activity });
}
