import { NextResponse } from 'next/server';
import { getServerDiagram } from '@/lib/serverStorage';
import { getDiagramActivity } from '@/lib/auditLog';
import { resolveAuthUserId } from '@/lib/auth';
import { findUserById } from '@/lib/userStorage';

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

  // Resolve userId -> display name once per distinct user, not once per
  // entry — a diagram with 100 entries from 2 people shouldn't mean 100
  // lookups. Snapshot is omitted here on purpose: this list view only needs
  // enough to render + let the user pick an entry to restore, not the full
  // nodes/edges payload for every one of up to 100 entries.
  const uniqueUserIds = Array.from(new Set(activity.map((e) => e.userId)));
  const userNames = new Map<string, string>();
  await Promise.all(
    uniqueUserIds.map(async (uid) => {
      const user = await findUserById(uid);
      if (user?.name) userNames.set(uid, user.name);
    })
  );

  const shaped = activity.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    userName: userNames.get(entry.userId) || entry.userId,
    actorType: entry.actorType,
    action: entry.action,
    timestamp: entry.timestamp,
    description: entry.description,
    // Totals as of this version — a size difference is often the fastest
    // way to tell entries apart when the description alone doesn't settle
    // it (e.g. two "edited" entries in a row).
    nodeCount: entry.snapshot?.nodes.length,
    edgeCount: entry.snapshot?.edges.length,
    restorable: !!entry.snapshot,
  }));

  return NextResponse.json({ activity: shaped });
}
