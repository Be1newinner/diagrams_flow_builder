import { NextResponse } from 'next/server';
import { comparePassword, issueLoginTokens, getRequestMeta } from '@/lib/auth';
import { findUserByEmail, updateUserRefreshToken, sanitizeUser } from '@/lib/userStorage';
import { saveOtp } from '@/lib/otpStorage';
import { sendOtpEmail } from '@/lib/mailer';

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

    // Opt-in two-factor: password is correct, but don't issue tokens yet —
    // send an OTP and make the client complete sign-in via
    // /api/auth/verify-login-otp instead.
    if (user.twoFactorEnabled) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await saveOtp({ email: user.email, otp, purpose: 'login-2fa', expiryMinutes: 10 });
      await sendOtpEmail({ to: user.email, otp, purpose: 'login-2fa', name: user.name });
      return NextResponse.json({
        success: false,
        requiresTwoFactor: true,
        email: user.email,
        message: `A 6-digit code was sent to ${user.email}.`,
      });
    }

    const { accessToken, refreshToken } = await issueLoginTokens(
      { id: user.id, email: user.email, name: user.name },
      getRequestMeta(request)
    );

    // Store refresh token in MongoDB too (legacy check some routes still do)
    await updateUserRefreshToken(user.id, refreshToken);

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
