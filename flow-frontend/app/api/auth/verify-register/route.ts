import { NextResponse } from 'next/server';
import { generateAccessToken, generateRefreshToken, setAuthCookies } from '@/lib/auth';
import { findUserByEmail, createUser, sanitizeUser } from '@/lib/userStorage';
import { verifyAndConsumeOtp } from '@/lib/otpStorage';
import { UserDocument } from '@/types/user';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return NextResponse.json({ error: 'Please provide a valid 6-digit verification code' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify and consume the OTP
    const verification = await verifyAndConsumeOtp({
      email: normalizedEmail,
      otp: otp.trim(),
      purpose: 'register',
    });

    if (!verification.success || !verification.metadata) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    const { name, passwordHash } = verification.metadata;
    if (!name || !passwordHash) {
      return NextResponse.json(
        { error: 'Registration session expired. Please register again.' },
        { status: 400 }
      );
    }

    // Double check user doesn't already exist
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in.' },
        { status: 409 }
      );
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newUser: UserDocument = {
      id: userId,
      name,
      email: normalizedEmail,
      passwordHash,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    // Issue tokens
    const accessToken = generateAccessToken({ id: userId, email: normalizedEmail, name: newUser.name });
    const refreshToken = generateRefreshToken({ id: userId });

    newUser.refreshToken = refreshToken;

    // Persist to MongoDB
    await createUser(newUser);

    // Set secure HttpOnly cookies
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json(
      {
        success: true,
        message: 'Account verified and created successfully!',
        user: sanitizeUser(newUser),
        accessToken,
        refreshToken,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Verify Register Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during verification' },
      { status: 500 }
    );
  }
}
