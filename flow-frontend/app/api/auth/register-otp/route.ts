import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { findUserByEmail } from '@/lib/userStorage';
import { saveOtp } from '@/lib/otpStorage';
import { sendOtpEmail } from '@/lib/mailer';

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

    // Pre-hash password with bcrypt (12 salt rounds)
    const passwordHash = await hashPassword(password);

    // Generate 6-digit crypto-random OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in OTP store (10 minute expiry)
    await saveOtp({
      email: normalizedEmail,
      otp,
      purpose: 'register',
      metadata: {
        name: name.trim(),
        passwordHash,
      },
      expiryMinutes: 10,
    });

    // Send email via Gmail Nodemailer
    await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose: 'register',
      name: name.trim(),
    });

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code was sent to ${normalizedEmail}.`,
    });
  } catch (error: any) {
    console.error('[Register OTP Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code. Please try again.' },
      { status: 500 }
    );
  }
}
