import { NextResponse } from 'next/server';
import { resolveAuthUserId, comparePassword } from '@/lib/auth';
import { findUserById, updateUserTwoFactor, sanitizeUser } from '@/lib/userStorage';

// Toggling 2FA requires re-entering the current password — a session that's
// already logged in (possibly hijacked via XSS, or left open on a shared
// machine) shouldn't be able to silently weaken account security without
// re-proving who's actually at the keyboard.
export async function POST(request: Request) {
  const userId = await resolveAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { enabled, password } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: '"enabled" must be true or false.' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Please confirm your current password.' }, { status: 400 });
    }

    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    await updateUserTwoFactor(userId, enabled);
    const updated = await findUserById(userId);

    return NextResponse.json({ success: true, user: updated ? sanitizeUser(updated) : undefined });
  } catch (error: any) {
    console.error('two-factor toggle error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
