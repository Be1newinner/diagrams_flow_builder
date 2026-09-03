import fs from 'fs';
import path from 'path';
import { Diagram } from '@/types/diagram';
import { STARTER_TEMPLATES } from './templates';
import clientPromise from './mongodb';

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

// --- Main Exported Functions (MongoDB with File Fallback & User Isolation) ---

export async function getServerDiagrams(userId?: string | null): Promise<Diagram[]> {
  // If user is not logged in, return ONLY the 3 starter sample templates
  if (!userId) {
    return STARTER_TEMPLATES;
  }

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const collection = db.collection<Diagram>('diagrams');

      const templateIds = STARTER_TEMPLATES.map((t) => t.id);

      // Query only user-owned diagrams plus system templates
      const docs = await collection
        .find({
          $or: [
            { userId: userId },
            { isTemplate: true },
            { id: { $in: templateIds } },
          ],
        })
        .sort({ updatedAt: -1 })
        .toArray();

      const userDocs = docs.map(({ _id, ...rest }: any) => rest as Diagram);

      // Ensure all 3 starter templates are present in the list
      const existingIds = new Set(userDocs.map((d) => d.id));
      const missingTemplates = STARTER_TEMPLATES.filter((t) => !existingIds.has(t.id));

      return [...userDocs, ...missingTemplates].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (err) {
      console.error('[MongoDB Error] Falling back to file storage:', err);
    }
  }

  const list = getFileDiagrams();
  return list
    .filter((d) => d.userId === userId || d.isTemplate || d.id.startsWith('template-'))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getServerDiagram(id: string, userId?: string | null): Promise<Diagram | null> {
  // 1. Check starter templates first (always viewable)
  const template = STARTER_TEMPLATES.find((t) => t.id === id);
  if (template) return template;

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const doc = await db.collection<Diagram>('diagrams').findOne({ id });
      if (doc) {
        const { _id, ...diagram } = doc as any;
        // Templates are public to view
        if (diagram.isTemplate || diagram.id?.startsWith('template-')) {
          return diagram as Diagram;
        }
        // User-owned diagrams are ONLY accessible by their owner
        if (userId && diagram.userId === userId) {
          return diagram as Diagram;
        }
        // Mismatch: diagram belongs to someone else
        return null;
      }
    } catch (err) {
      console.error('[MongoDB Error] getServerDiagram fallback:', err);
    }
  }

  const list = getFileDiagrams();
  const found = list.find((d) => d.id === id);
  if (!found) return null;
  if (found.isTemplate || found.id.startsWith('template-')) return found;
  if (userId && found.userId === userId) return found;
  return null;
}

export const MAX_DIAGRAMS_PER_USER = 30;

export async function getUserDiagramCount(userId: string): Promise<number> {
  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const count = await db.collection('diagrams').countDocuments({
        userId,
        isTemplate: { $ne: true },
        id: { $not: /^template-/ },
      });
      return count;
    } catch (err) {
      console.error('[MongoDB Error] getUserDiagramCount error:', err);
    }
  }

  const list = getFileDiagrams();
  return list.filter((d) => d.userId === userId && !d.isTemplate && !d.id.startsWith('template-')).length;
}

export async function saveServerDiagram(diagram: Diagram, userId: string): Promise<Diagram> {
  // Prevent altering system sample templates
  if (diagram.isTemplate || diagram.id.startsWith('template-')) {
    throw new Error('Cannot modify built-in sample templates. Duplicate to your account instead.');
  }

  // Check if diagram is new (not an update to an existing diagram)
  const existing = await getServerDiagram(diagram.id, userId);
  if (!existing) {
    const currentCount = await getUserDiagramCount(userId);
    if (currentCount >= MAX_DIAGRAMS_PER_USER) {
      throw new Error(`Diagram limit reached (${MAX_DIAGRAMS_PER_USER}/${MAX_DIAGRAMS_PER_USER}). Please delete older diagrams to create new ones.`);
    }
  }

  const updated: Diagram = {
    ...diagram,
    userId,
    isTemplate: false,
    updatedAt: new Date().toISOString(),
  };

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      // Upsert only if user is owner or document is new
      await db.collection('diagrams').updateOne(
        {
          id: updated.id,
          $or: [{ userId: userId }, { userId: { $exists: false } }],
        },
        { $set: updated },
        { upsert: true }
      );
    } catch (err) {
      console.error('[MongoDB Error] saveServerDiagram error:', err);
    }
  }

  // Also sync to local file for backup/offline
  saveFileDiagram(updated);
  return updated;
}

export async function deleteServerDiagram(id: string, userId: string): Promise<boolean> {
  // Disallow deleting system sample templates
  if (id.startsWith('template-') || STARTER_TEMPLATES.some((t) => t.id === id)) {
    return false;
  }

  let deletedFromMongo = false;
  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      // Delete ONLY if owner matches
      const res = await db.collection('diagrams').deleteOne({ id, userId });
      deletedFromMongo = res.deletedCount > 0;
    } catch (err) {
      console.error('[MongoDB Error] deleteServerDiagram error:', err);
    }
  }

  const deletedFromFile = deleteFileDiagram(id);
  return deletedFromMongo || deletedFromFile;
}
