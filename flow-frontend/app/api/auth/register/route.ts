import { NextResponse } from 'next/server';
import { hashPassword, generateAccessToken, generateRefreshToken, setAuthCookies } from '@/lib/auth';
import { findUserByEmail, createUser, sanitizeUser } from '@/lib/userStorage';
import { UserDocument } from '@/types/user';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt (12 salt rounds)
    const passwordHash = await hashPassword(password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newUser: UserDocument = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    // Generate tokens: Access Token valid 1 Day, Refresh Token valid 28 Days
    const accessToken = generateAccessToken({ id: userId, email: normalizedEmail, name: newUser.name });
    const refreshToken = generateRefreshToken({ id: userId });

    newUser.refreshToken = refreshToken;

    // Persist to MongoDB Atlas
    await createUser(newUser);

    // Set secure HttpOnly cookies
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully',
        user: sanitizeUser(newUser),
        accessToken,
        refreshToken,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
