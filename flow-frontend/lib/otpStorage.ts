import fs from 'fs';
import path from 'path';
import { redis, isRedisConfigured } from '@/lib/redis';

export interface OtpRecord {
  email: string;
  otp: string;
  purpose: 'register' | 'reset-password' | 'login-2fa';
  metadata?: {
    name?: string;
    passwordHash?: string;
  };
  expiresAt: Date;
  createdAt: Date;
}

// OTPs are short-lived, single-purpose, and looked up by exact key — the
// textbook case for a TTL'd Redis value instead of a Mongo collection.
// Redis handles the expiry itself (no manual expireAfterSeconds index or
// cleanup job, unlike the old Mongo path), and SET-with-expiry on the same
// key naturally replaces any prior pending OTP for that email+purpose.
function otpKey(email: string, purpose: string): string {
  return `otp:${purpose}:${email}`;
}

interface StoredOtp {
  otp: string;
  metadata?: OtpRecord['metadata'];
  createdAt: string;
}

// --- Local file fallback, used only when Redis isn't configured (e.g. local
// dev without Upstash env vars set) ---
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

export async function saveOtp({
  email,
  otp,
  purpose,
  metadata,
  expiryMinutes = 10,
}: {
  email: string;
  otp: string;
  purpose: 'register' | 'reset-password' | 'login-2fa';
  metadata?: {
    name?: string;
    passwordHash?: string;
  };
  expiryMinutes?: number;
}): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  if (isRedisConfigured() && redis) {
    try {
      const value: StoredOtp = { otp, metadata, createdAt: now.toISOString() };
      await redis.set(otpKey(normalizedEmail, purpose), value, { ex: expiryMinutes * 60 });
      return;
    } catch (err) {
      console.error('[Redis Error] saveOtp fallback to file:', err);
    }
  }

  // File fallback
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  const record: OtpRecord = { email: normalizedEmail, otp, purpose, metadata, expiresAt, createdAt: now };
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
  purpose: 'register' | 'reset-password' | 'login-2fa';
}): Promise<{ success: boolean; error?: string; metadata?: OtpRecord['metadata'] }> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedOtp = otp.trim();

  if (isRedisConfigured() && redis) {
    try {
      const key = otpKey(normalizedEmail, purpose);
      const data = await redis.get<StoredOtp>(key);

      if (!data) {
        return { success: false, error: 'Verification code expired or not found. Please request a new code.' };
      }

      if (data.otp !== trimmedOtp) {
        // Wrong code: leave the pending OTP in place so the user can retry
        // until it actually expires, matching the previous Mongo behavior.
        return { success: false, error: 'Invalid verification code. Please check and try again.' };
      }

      // Valid OTP: delete it immediately so it cannot be reused
      await redis.del(key);
      return { success: true, metadata: data.metadata };
    } catch (err) {
      console.error('[Redis Error] verifyAndConsumeOtp fallback:', err);
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
