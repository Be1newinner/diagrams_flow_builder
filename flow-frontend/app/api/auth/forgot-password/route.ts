import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/userStorage';
import { saveOtp } from '@/lib/otpStorage';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify account exists
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address. Please register or check your spelling.' },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in OTP store
    await saveOtp({
      email: normalizedEmail,
      otp,
      purpose: 'reset-password',
      expiryMinutes: 10,
    });

    // Send email via Gmail Nodemailer
    await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose: 'reset-password',
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      message: `A 6-digit password reset code was sent to ${normalizedEmail}.`,
    });
  } catch (error: any) {
    console.error('[Forgot Password Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send password reset code. Please try again.' },
      { status: 500 }
    );
  }
}
