import { NextResponse } from 'next/server';
import { issueLoginTokens, getRequestMeta } from '@/lib/auth';
import { findUserByEmail, updateUserRefreshToken, sanitizeUser } from '@/lib/userStorage';
import { verifyAndConsumeOtp } from '@/lib/otpStorage';

// Completes the 2FA login step started by /api/auth/login (which, for a
// user with twoFactorEnabled, stops short of issuing tokens and emails an
// OTP instead). Deliberately re-verifies the password is not required here
// — that was already checked in the login step; this only ever needs the
// OTP, matching the same trust boundary the register/reset-password OTP
// flows already use.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const verification = await verifyAndConsumeOtp({ email: normalizedEmail, otp, purpose: 'login-2fa' });
    if (!verification.success) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { accessToken, refreshToken } = await issueLoginTokens(
      { id: user.id, email: user.email, name: user.name },
      getRequestMeta(request)
    );
    await updateUserRefreshToken(user.id, refreshToken);

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('verify-login-otp error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
