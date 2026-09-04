import clientPromise from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

export interface OtpRecord {
  email: string;
  otp: string;
  purpose: 'register' | 'reset-password';
  metadata?: {
    name?: string;
    passwordHash?: string;
  };
  expiresAt: Date;
  createdAt: Date;
}

const LOCAL_OTP_FILE = path.join(process.cwd(), 'data', 'otps.json');

function ensureLocalDir() {
  const dir = path.dirname(LOCAL_OTP_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLocalOtps(): OtpRecord[] {
  ensureLocalDir();
  if (!fs.existsSync(LOCAL_OTP_FILE)) return [];
  try {
    const raw = fs.readFileSync(LOCAL_OTP_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.map((item: any) => ({
      ...item,
      expiresAt: new Date(item.expiresAt),
      createdAt: new Date(item.createdAt),
    }));
  } catch {
    return [];
  }
}

function saveLocalOtps(otps: OtpRecord[]) {
  ensureLocalDir();
  fs.writeFileSync(LOCAL_OTP_FILE, JSON.stringify(otps, null, 2));
}

let ttlIndexEnsured = false;
async function ensureTtlIndex() {
  if (ttlIndexEnsured || !process.env.MONGODB_URI) return;
  try {
    const client = await clientPromise;
    const db = client.db('flowcraft');
    await db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    ttlIndexEnsured = true;
  } catch (err) {
    console.error('[MongoDB Error] ensureTtlIndex:', err);
  }
}

export async function saveOtp({
  email,
  otp,
  purpose,
  metadata,
  expiryMinutes = 10,
}: {
  email: string;
  otp: string;
  purpose: 'register' | 'reset-password';
  metadata?: {
    name?: string;
    passwordHash?: string;
  };
  expiryMinutes?: number;
}): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

  const record: OtpRecord = {
    email: normalizedEmail,
    otp,
    purpose,
    metadata,
    expiresAt,
    createdAt: now,
  };

  if (process.env.MONGODB_URI) {
    try {
      await ensureTtlIndex();
      const client = await clientPromise;
      const db = client.db('flowcraft');
      // Remove any prior pending OTP for this email and purpose
      await db.collection('otps').deleteMany({ email: normalizedEmail, purpose });
      await db.collection('otps').insertOne(record as any);
      return;
    } catch (err) {
      console.error('[MongoDB Error] saveOtp fallback to file:', err);
    }
  }

  // File fallback
  const list = getLocalOtps().filter((o) => !(o.email === normalizedEmail && o.purpose === purpose));
  list.push(record);
  saveLocalOtps(list);
}

export async function verifyAndConsumeOtp({
  email,
  otp,
  purpose,
}: {
  email: string;
  otp: string;
  purpose: 'register' | 'reset-password';
}): Promise<{ success: boolean; error?: string; metadata?: OtpRecord['metadata'] }> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedOtp = otp.trim();

  if (process.env.MONGODB_URI) {
    try {
      const client = await clientPromise;
      const db = client.db('flowcraft');
      const found: any = await db.collection('otps').findOne({
        email: normalizedEmail,
        purpose,
      });

      if (!found) {
        return { success: false, error: 'Verification code expired or not found. Please request a new code.' };
      }

      if (new Date() > new Date(found.expiresAt)) {
        await db.collection('otps').deleteOne({ _id: found._id });
        return { success: false, error: 'Verification code has expired. Please request a new code.' };
      }

      if (found.otp !== trimmedOtp) {
        return { success: false, error: 'Invalid verification code. Please check and try again.' };
      }

      // Valid OTP: delete it immediately so it cannot be reused
      await db.collection('otps').deleteOne({ _id: found._id });
      return { success: true, metadata: found.metadata };
    } catch (err) {
      console.error('[MongoDB Error] verifyAndConsumeOtp fallback:', err);
    }
  }

  // File fallback
  const list = getLocalOtps();
  const found = list.find((o) => o.email === normalizedEmail && o.purpose === purpose);

  if (!found) {
    return { success: false, error: 'Verification code expired or not found. Please request a new code.' };
  }

  if (new Date() > found.expiresAt) {
    saveLocalOtps(list.filter((o) => o !== found));
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (found.otp !== trimmedOtp) {
    return { success: false, error: 'Invalid verification code. Please check and try again.' };
  }

  saveLocalOtps(list.filter((o) => o !== found));
  return { success: true, metadata: found.metadata };
}
