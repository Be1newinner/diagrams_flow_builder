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

// --- Main Exported Functions (MongoDB with File Fallback) ---

export async function getServerDiagrams(): Promise<Diagram[]> {
  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const collection = db.collection<Diagram>('diagrams');

      const count = await collection.countDocuments();
      if (count === 0) {
        // Seed initial templates
        await collection.insertMany(STARTER_TEMPLATES as any);
        return STARTER_TEMPLATES;
      }

      const docs = await collection.find({}).sort({ updatedAt: -1 }).toArray();
      // Remove MongoDB _id before returning to avoid serialization issues
      return docs.map(({ _id, ...rest }: any) => rest as Diagram);
    } catch (err) {
      console.error('[MongoDB Error] Falling back to file storage:', err);
    }
  }

  return getFileDiagrams().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getServerDiagram(id: string): Promise<Diagram | null> {
  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const doc = await db.collection<Diagram>('diagrams').findOne({ id });
      if (doc) {
        const { _id, ...rest } = doc as any;
        return rest as Diagram;
      }
    } catch (err) {
      console.error('[MongoDB Error] getServerDiagram fallback:', err);
    }
  }

  const list = getFileDiagrams();
  return list.find((d) => d.id === id) || null;
}

export async function saveServerDiagram(diagram: Diagram): Promise<Diagram> {
  const updated: Diagram = {
    ...diagram,
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
  return updated;
}

export async function deleteServerDiagram(id: string): Promise<boolean> {
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
  return deletedFromMongo || deletedFromFile;
}
