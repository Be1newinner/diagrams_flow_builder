import fs from 'fs';
import path from 'path';
import { Diagram, DiagramUserAccess } from '@/types/diagram';
import { STARTER_TEMPLATES } from './templates';
import clientPromise from './mongodb';
import { publishDiagramUpdate } from './ably';
import {
  getCachedDiagram,
  setCachedDiagram,
  deleteCachedDiagram,
  getCachedDiagramList,
  setCachedDiagramList,
  invalidateDiagramListCache,
} from './diagramCache';
import { logDiagramActivity, deleteDiagramActivity } from './auditLog';

const DATA_DIR = path.resolve(process.cwd(), '../data');
const DATA_FILE = path.join(DATA_DIR, 'diagrams.json');

// --- File Fallback Helpers ---
function getFileDiagrams(): Diagram[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(STARTER_TEMPLATES, null, 2), 'utf-8');
      return STARTER_TEMPLATES;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : STARTER_TEMPLATES;
  } catch {
    return STARTER_TEMPLATES;
  }
}

function saveFileDiagram(diagram: Diagram): void {
  try {
    const list = getFileDiagrams();
    const idx = list.findIndex((d) => d.id === diagram.id);
    let nextList: Diagram[];
    if (idx >= 0) {
      nextList = [...list];
      nextList[idx] = diagram;
    } else {
      nextList = [diagram, ...list];
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(nextList, null, 2), 'utf-8');
  } catch (err) {
    console.error('File fallback save error:', err);
  }
}

function deleteFileDiagram(id: string): boolean {
  try {
    const list = getFileDiagrams();
    const filtered = list.filter((d) => d.id !== id);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return filtered.length < list.length;
  } catch {
    return false;
  }
}

// Normalizes users array on diagram to ensure exactly one ADMIN, preserving
// each other member's own EDITOR/VIEWER role rather than collapsing
// everyone non-admin to VIEWER.
export function normalizeDiagramUsers(diagram: Diagram, defaultAdminId: string): DiagramUserAccess[] {
  const existingUsers = diagram.users && diagram.users.length > 0 ? [...diagram.users] : [];

  // Find designated admin
  const foundAdmin = existingUsers.find((u) => u.accesstype === 'ADMIN');
  const adminId = foundAdmin?.userId || diagram.userId || defaultAdminId;

  // Filter out any duplicate admin entries; keep everyone else's own role.
  const others = existingUsers
    .filter((u) => u.userId !== adminId)
    .map((u) => ({
      userId: u.userId,
      accesstype: u.accesstype === 'EDITOR' ? ('EDITOR' as const) : ('VIEWER' as const),
    }));

  return [
    { userId: adminId, accesstype: 'ADMIN' as const },
    ...others,
  ];
}

// --- Main Exported Functions (MongoDB with File Fallback & User Access Control) ---

export async function getServerDiagrams(userId?: string | null): Promise<Diagram[]> {
  // If user is not logged in, return ONLY the 3 starter sample templates
  if (!userId) {
    return STARTER_TEMPLATES;
  }

  const cached = await getCachedDiagramList(userId);
  if (cached) {
    return cached;
  }

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const collection = db.collection<Diagram>('diagrams');

      const templateIds = STARTER_TEMPLATES.map((t) => t.id);

      // Query diagrams where user is owner OR listed in users[] OR is a template
      const docs = await collection
        .find({
          $or: [
            { userId: userId },
            { 'users.userId': userId },
            { isPublic: true },
            { isTemplate: true },
            { id: { $in: templateIds } },
          ],
        })
        .sort({ updatedAt: -1 })
        .toArray();

      const userDocs = docs.map(({ _id, ...rest }: any) => {
        const d = rest as Diagram;
        if (!d.users || d.users.length === 0) {
          d.users = d.userId ? [{ userId: d.userId, accesstype: 'ADMIN' }] : [];
        }
        return d;
      });

      // Ensure all 3 starter templates are present in the list
      const existingIds = new Set(userDocs.map((d) => d.id));
      const missingTemplates = STARTER_TEMPLATES.filter((t) => !existingIds.has(t.id));

      const result = [...userDocs, ...missingTemplates].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setCachedDiagramList(userId, result);
      return result;
    } catch (err) {
      console.error('[MongoDB Error] Falling back to file storage:', err);
    }
  }

  const list = getFileDiagrams();
  const result = list
    .filter(
      (d) =>
        d.userId === userId ||
        d.users?.some((u) => u.userId === userId) ||
        d.isPublic === true ||
        d.isTemplate ||
        d.id.startsWith('template-')
    )
    .map((d) => {
      if (!d.users || d.users.length === 0) {
        d.users = d.userId ? [{ userId: d.userId, accesstype: 'ADMIN' }] : [];
      }
      return d;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  setCachedDiagramList(userId, result);
  return result;
}

// Applies the same ADMIN/VIEWER/template access check regardless of whether
// the raw document came from cache, Mongo, or the file fallback — caching
// only ever substitutes for the fetch, never for this check.
function withAccessCheck(diagram: Diagram, userId?: string | null): Diagram | null {
  if (diagram.isTemplate || diagram.id.startsWith('template-')) {
    return diagram;
  }

  // `isPublic` grants VIEW access to literally anyone, signed in or not —
  // it never adds them to `users[]`, so saveServerDiagram/deleteServerDiagram's
  // ADMIN checks (which only ever consult `users[]`) remain untouched by
  // this, and an anonymous visitor can never end up with edit rights.
  const hasAccess =
    diagram.isPublic === true ||
    (!!userId && (diagram.userId === userId || diagram.users?.some((u) => u.userId === userId)));

  if (!hasAccess) return null;

  if (!diagram.users || diagram.users.length === 0) {
    diagram.users = diagram.userId ? [{ userId: diagram.userId, accesstype: 'ADMIN' }] : [];
  }
  return diagram;
}

export async function getServerDiagram(id: string, userId?: string | null): Promise<Diagram | null> {
  // 1. Check starter templates first (always viewable, never cached — they're
  // static in-memory constants already)
  const template = STARTER_TEMPLATES.find((t) => t.id === id);
  if (template) {
    return {
      ...template,
      users: [{ userId: 'system', accesstype: 'ADMIN' }],
    };
  }

  // 2. Cache — the hot path for repeat reads of the same diagram (flow page
  // loads, drift polls, MCP tool calls). Miss falls through to Mongo/file
  // exactly as before.
  const cached = await getCachedDiagram(id);
  if (cached) {
    return withAccessCheck(cached, userId);
  }

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const doc = await db.collection<Diagram>('diagrams').findOne({ id });
      if (doc) {
        const { _id, ...diagram } = doc as any;
        setCachedDiagram(diagram as Diagram);
        return withAccessCheck(diagram as Diagram, userId);
      }
    } catch (err) {
      console.error('[MongoDB Error] getServerDiagram fallback:', err);
    }
  }

  const list = getFileDiagrams();
  const found = list.find((d) => d.id === id);
  if (!found) return null;
  setCachedDiagram(found);
  return withAccessCheck(found, userId);
}

export const MAX_DIAGRAMS_PER_USER = 30;

export async function getUserDiagramCount(userId: string): Promise<number> {
  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      // Count only diagrams where user is ADMIN (owner)
      const count = await db.collection('diagrams').countDocuments({
        $or: [
          { userId },
          { users: { $elemMatch: { userId, accesstype: 'ADMIN' } } },
        ],
        isTemplate: { $ne: true },
        id: { $not: /^template-/ },
      });
      return count;
    } catch (err) {
      console.error('[MongoDB Error] getUserDiagramCount error:', err);
    }
  }

  const list = getFileDiagrams();
  return list.filter(
    (d) =>
      (d.userId === userId || d.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN')) &&
      !d.isTemplate &&
      !d.id.startsWith('template-')
  ).length;
}

export async function saveServerDiagram(
  diagram: Diagram,
  userId: string,
  preFetchedExisting?: Diagram | null
): Promise<Diagram> {
  // Prevent altering system sample templates
  if (diagram.isTemplate || diagram.id.startsWith('template-')) {
    throw new Error('Cannot modify built-in sample templates. Duplicate to your account instead.');
  }

  // Check if diagram is new or updating existing. Callers that already fetched
  // (and access-checked) this diagram in the same request can pass it via
  // preFetchedExisting to skip a redundant MongoDB round trip here — every
  // node/edge mutation was doing 2 reads + 1 write per call before this.
  const existing = preFetchedExisting !== undefined ? preFetchedExisting : await getServerDiagram(diagram.id, userId);
  if (existing) {
    // ADMIN and EDITOR can both edit content; only ADMIN can delete or
    // manage sharing (checked separately in those functions below).
    const canEdit =
      existing.userId === userId ||
      existing.users?.some(
        (u) => u.userId === userId && (u.accesstype === 'ADMIN' || u.accesstype === 'EDITOR')
      );

    if (!canEdit) {
      throw new Error('Forbidden: Only the diagram ADMIN or an EDITOR can edit this diagram.');
    }
  } else {
    // Creating new diagram: enforce 30-diagram limit on creating ADMIN
    const currentCount = await getUserDiagramCount(userId);
    if (currentCount >= MAX_DIAGRAMS_PER_USER) {
      throw new Error(
        `Diagram limit reached (${MAX_DIAGRAMS_PER_USER}/${MAX_DIAGRAMS_PER_USER}). Please delete older diagrams to create new ones.`
      );
    }
  }

  // Enforce exactly one ADMIN and multiple VIEWERS in users[]
  const adminId = existing?.users?.find((u) => u.accesstype === 'ADMIN')?.userId || existing?.userId || userId;
  const finalUsers = normalizeDiagramUsers(diagram, adminId);

  const updated: Diagram = {
    ...diagram,
    userId: adminId,
    users: finalUsers,
    isTemplate: false,
    updatedAt: new Date().toISOString(),
  };

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      await db.collection('diagrams').updateOne(
        { id: updated.id },
        { $set: updated },
        { upsert: true }
      );
    } catch (err) {
      console.error('[MongoDB Error] saveServerDiagram error:', err);
    }
  }

  // Also sync to local file for backup/offline
  saveFileDiagram(updated);

  // Write-through the cache with the value we just persisted, rather than
  // just invalidating it — the very next read (often milliseconds later,
  // e.g. this same save's own PUT response, or another tab's drift poll)
  // gets a cache hit instead of a guaranteed-miss round trip back to Mongo.
  setCachedDiagram(updated);
  // The list view's sort order and content depend on this diagram, so its
  // cached list is no longer valid — simpler to drop it than merge in place.
  invalidateDiagramListCache(adminId);

  logDiagramActivity(updated.id, userId, existing ? 'updated' : 'created');

  // Notify anyone with this diagram open — another tab, another user, or an
  // MCP tool client — right away instead of making them poll for it. This is
  // the single choke point every save path (PUT route, POST route, and every
  // MCP tool handler) already goes through.
  publishDiagramUpdate(updated.id, updated.updatedAt);

  return updated;
}

// --- Sharing ---
// All three helpers reuse saveServerDiagram's own ADMIN-only write path
// (and therefore its cache write-through, list-cache invalidation, Ably
// publish, and audit log) rather than writing to Mongo/file directly here —
// sharing is just a mutation of `users[]` / `isPublic` on the same document.

export async function shareDiagramWithUser(
  diagramId: string,
  adminUserId: string,
  viewerUserId: string,
  accesstype: 'VIEWER' | 'EDITOR' = 'VIEWER'
): Promise<Diagram> {
  const existing = await getServerDiagram(diagramId, adminUserId);
  if (!existing) throw new Error('Diagram not found or access denied');

  const isAdmin =
    existing.userId === adminUserId ||
    existing.users?.some((u) => u.userId === adminUserId && u.accesstype === 'ADMIN');
  if (!isAdmin) throw new Error('Forbidden: Only the diagram ADMIN can share this diagram.');

  if (viewerUserId === adminUserId) throw new Error('You already have access to this diagram.');

  const alreadyShared = existing.users?.some((u) => u.userId === viewerUserId);
  const nextUsers = alreadyShared
    // Already invited — re-inviting with a role changes it (promote/demote)
    // instead of being a no-op, so the same UI action works for both cases.
    ? (existing.users || []).map((u) => (u.userId === viewerUserId ? { ...u, accesstype } : u))
    : [...(existing.users || []), { userId: viewerUserId, accesstype }];

  const updated: Diagram = { ...existing, users: nextUsers };
  return saveServerDiagram(updated, adminUserId, existing);
}

export async function revokeDiagramAccess(
  diagramId: string,
  adminUserId: string,
  targetUserId: string
): Promise<Diagram> {
  const existing = await getServerDiagram(diagramId, adminUserId);
  if (!existing) throw new Error('Diagram not found or access denied');

  const isAdmin =
    existing.userId === adminUserId ||
    existing.users?.some((u) => u.userId === adminUserId && u.accesstype === 'ADMIN');
  if (!isAdmin) throw new Error('Forbidden: Only the diagram ADMIN can manage sharing.');
  if (targetUserId === adminUserId) throw new Error('Cannot remove the diagram ADMIN.');

  const updated: Diagram = {
    ...existing,
    users: (existing.users || []).filter((u) => u.userId !== targetUserId),
  };
  return saveServerDiagram(updated, adminUserId, existing);
}

export async function setDiagramPublic(
  diagramId: string,
  adminUserId: string,
  isPublic: boolean
): Promise<Diagram> {
  const existing = await getServerDiagram(diagramId, adminUserId);
  if (!existing) throw new Error('Diagram not found or access denied');

  const isAdmin =
    existing.userId === adminUserId ||
    existing.users?.some((u) => u.userId === adminUserId && u.accesstype === 'ADMIN');
  if (!isAdmin) throw new Error('Forbidden: Only the diagram ADMIN can manage sharing.');

  const updated: Diagram = { ...existing, isPublic };
  return saveServerDiagram(updated, adminUserId, existing);
}

export async function deleteServerDiagram(id: string, userId: string): Promise<boolean> {
  // Disallow deleting system sample templates
  if (id.startsWith('template-') || STARTER_TEMPLATES.some((t) => t.id === id)) {
    return false;
  }

  const existing = await getServerDiagram(id, userId);
  if (!existing) return false;

  // Only ADMIN can delete!
  const isAdmin =
    existing.userId === userId ||
    existing.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN');

  if (!isAdmin) {
    throw new Error('Forbidden: Only the diagram ADMIN can delete this diagram.');
  }

  let deletedFromMongo = false;
  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const res = await db.collection('diagrams').deleteOne({ id });
      deletedFromMongo = res.deletedCount > 0;
    } catch (err) {
      console.error('[MongoDB Error] deleteServerDiagram error:', err);
    }
  }

  const deletedFromFile = deleteFileDiagram(id);
  const deleted = deletedFromMongo || deletedFromFile;
  if (deleted) {
    deleteCachedDiagram(id);
    invalidateDiagramListCache(userId);
    deleteDiagramActivity(id);
  }
  return deleted;
}
