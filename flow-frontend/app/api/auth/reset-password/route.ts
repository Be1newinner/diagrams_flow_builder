import { NextResponse } from 'next/server';
import { hashPassword, generateAccessToken, generateRefreshToken, setAuthCookies } from '@/lib/auth';
import { findUserByEmail, updateUserPassword, updateUserVerification, sanitizeUser } from '@/lib/userStorage';
import { verifyAndConsumeOtp } from '@/lib/otpStorage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
      return NextResponse.json({ error: 'Please provide a valid 6-digit reset code' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify user exists
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // Verify and consume OTP
    const verification = await verifyAndConsumeOtp({
      email: normalizedEmail,
      otp: otp.trim(),
      purpose: 'reset-password',
    });

    if (!verification.success) {
      return NextResponse.json(
        { error: verification.error || 'Invalid or expired reset code' },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update in MongoDB
    await updateUserPassword(user.id, newPasswordHash);
    await updateUserVerification(user.id, true);
    user.isVerified = true;

    // Issue fresh tokens and log the user in
    const accessToken = generateAccessToken({ id: user.id, email: user.email, name: user.name });
    const refreshToken = generateRefreshToken({ id: user.id });

    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You are now signed in.',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('[Reset Password Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error resetting password' },
      { status: 500 }
    );
  }
}
