import { POST as registerOtpHandler } from '../register-otp/route';

// Direct unverified registration is disabled. All registration attempts must go through OTP verification.
export async function POST(request: Request) {
  return registerOtpHandler(request);
}
