import { NextResponse } from 'next/server';
import { comparePassword, generateAccessToken, generateRefreshToken, setAuthCookies } from '@/lib/auth';
import { findUserByEmail, updateUserRefreshToken, sanitizeUser } from '@/lib/userStorage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by email in MongoDB Atlas
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify bcrypt password hash
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Strictly enforce isVerified (must be verified at register stage)
    if (user.isVerified !== true) {
      return NextResponse.json(
        {
          error: 'Your account has not been verified yet. Please complete verification with the 6-digit code to sign in.',
          needsVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Generate tokens: Access Token valid 1 Day, Refresh Token valid 28 Days
    const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
    const refreshToken = generateRefreshToken({ id: user.id });

    // Store refresh token in MongoDB for session management
    await updateUserRefreshToken(user.id, refreshToken);

    // Set secure HttpOnly cookies (1-day access, 28-day refresh)
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
