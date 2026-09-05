import { Collection } from 'mongodb';
import clientPromise from './mongodb';
import { UserDocument, User } from '@/types/user';

async function getUsersCollection(): Promise<Collection<UserDocument> | null> {
  if (!process.env.MONGODB_URI) return null;
  try {
    const client = await clientPromise;
    const db = client.db('flowcraft');
    const col = db.collection<UserDocument>('users');
    // Ensure index on email
    await col.createIndex({ email: 1 }, { unique: true }).catch(() => {});
    return col;
  } catch (err) {
    console.error('[MongoDB Error] users collection error:', err);
    return null;
  }
}

// In-memory fallback if MongoDB is offline
const memoryUsers = new Map<string, UserDocument>();

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  const normalized = email.trim().toLowerCase();
  const col = await getUsersCollection();
  if (col) {
    try {
      const doc = await col.findOne({ email: normalized });
      if (doc) {
        const { _id, ...rest } = doc as any;
        return rest as UserDocument;
      }
      return null;
    } catch (err) {
      console.error('Error finding user by email in Mongo:', err);
    }
  }

  // Fallback
  for (const user of memoryUsers.values()) {
    if (user.email.toLowerCase() === normalized) return user;
  }
  return null;
}

export async function findUserById(id: string): Promise<UserDocument | null> {
  const col = await getUsersCollection();
  if (col) {
    try {
      const doc = await col.findOne({ id });
      if (doc) {
        const { _id, ...rest } = doc as any;
        return rest as UserDocument;
      }
      return null;
    } catch (err) {
      console.error('Error finding user by id in Mongo:', err);
    }
  }

  return memoryUsers.get(id) || null;
}

export async function createUser(user: UserDocument): Promise<UserDocument> {
  const col = await getUsersCollection();
  if (col) {
    try {
      await col.insertOne({ ...user } as any);
      return user;
    } catch (err) {
      console.error('Error inserting user in Mongo:', err);
    }
  }

  memoryUsers.set(user.id, user);
  return user;
}

export async function updateUserRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
  const col = await getUsersCollection();
  if (col) {
    try {
      await col.updateOne(
        { id: userId },
        {
          $set: {
            refreshToken,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      return;
    } catch (err) {
      console.error('Error updating refresh token in Mongo:', err);
    }
  }

  const user = memoryUsers.get(userId);
  if (user) {
    user.refreshToken = refreshToken;
    user.updatedAt = new Date().toISOString();
  }
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  const col = await getUsersCollection();
  if (col) {
    try {
      await col.updateOne(
        { id: userId },
        {
          $set: {
            passwordHash,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      return;
    } catch (err) {
      console.error('Error updating user password in Mongo:', err);
    }
  }

  const user = memoryUsers.get(userId);
  if (user) {
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
  }
}

export async function updateUserVerification(userId: string, isVerified: boolean): Promise<void> {
  const col = await getUsersCollection();
  if (col) {
    try {
      await col.updateOne(
        { id: userId },
        {
          $set: {
            isVerified,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      return;
    } catch (err) {
      console.error('Error updating user verification in Mongo:', err);
    }
  }

  const user = memoryUsers.get(userId);
  if (user) {
    user.isVerified = isVerified;
    user.updatedAt = new Date().toISOString();
  }
}

export async function updateUserTwoFactor(userId: string, enabled: boolean): Promise<void> {
  const col = await getUsersCollection();
  if (col) {
    try {
      await col.updateOne(
        { id: userId },
        {
          $set: {
            twoFactorEnabled: enabled,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      return;
    } catch (err) {
      console.error('Error updating two-factor setting in Mongo:', err);
    }
  }

  const user = memoryUsers.get(userId);
  if (user) {
    user.twoFactorEnabled = enabled;
    user.updatedAt = new Date().toISOString();
  }
}

export function sanitizeUser(user: UserDocument): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified === true,
    twoFactorEnabled: user.twoFactorEnabled === true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
