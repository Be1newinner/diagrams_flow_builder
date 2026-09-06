import nodemailer from 'nodemailer';

const user = process.env.GMAIL_ID || 'teamshipsardevelopers@gmail.com';
const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user,
    pass,
  },
});

export async function sendOtpEmail({
  to,
  otp,
  purpose,
  name,
}: {
  to: string;
  otp: string;
  purpose: 'register' | 'reset-password' | 'login-2fa';
  name?: string;
}): Promise<void> {
  const isRegister = purpose === 'register';
  const isTwoFactor = purpose === 'login-2fa';
  const subject = isRegister
    ? `${otp} is your FlowCraft registration code`
    : isTwoFactor
    ? `${otp} is your FlowCraft sign-in code`
    : `${otp} is your FlowCraft password reset code`;

  const title = isRegister ? 'Verify Your Email' : isTwoFactor ? 'Confirm Sign-In' : 'Reset Your Password';
  const subtitle = isRegister
    ? `Welcome to FlowCraft${name ? `, ${name}` : ''}! Use the verification code below to activate your account.`
    : isTwoFactor
    ? `Two-factor authentication is enabled on your account. Enter the code below to finish signing in.`
    : `We received a request to reset the password for your FlowCraft account.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #7c3aed); text-align: center; line-height: 48px; font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                      ⚡
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">FlowCraft</h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Visual Diagram & System Design Studio</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">${title}</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">${subtitle}</p>

              <!-- OTP Code Display -->
              <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="display: block; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1e293b; padding-left: 10px;">
                  ${otp}
                </div>
                <span style="display: block; font-size: 12px; color: #64748b; margin-top: 10px;">Valid for <strong>10 minutes</strong></span>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">
                ${
                  isRegister
                    ? 'Enter this code in FlowCraft to verify your email and finish setting up your account.'
                    : 'Enter this code along with your new password to restore access to your account.'
                }
              </p>

              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 16px;">
                  If you did not request this verification code, please ignore this email or contact support. Your account is secure.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                A product built with love by <a href="https://www.shipsar.in" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">Shipsar Developers</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"FlowCraft" <${user}>`,
    to,
    subject,
    html,
  });
}

export async function sendShareEmail({
  to,
  diagramTitle,
  diagramUrl,
  sharedByName,
}: {
  to: string;
  diagramTitle: string;
  diagramUrl: string;
  sharedByName: string;
}): Promise<void> {
  const subject = `${sharedByName} shared "${diagramTitle}" with you on FlowCraft`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagram shared with you</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #7c3aed); text-align: center; line-height: 48px; font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                      ⚡
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">FlowCraft</h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Visual Diagram & System Design Studio</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">A diagram was shared with you</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #475569;">
                <strong>${sharedByName}</strong> invited you to view <strong>"${diagramTitle}"</strong> on FlowCraft. You'll have read-only (viewer) access — you can look around and export it, but not edit it.
              </p>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${diagramUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                  Open Diagram
                </a>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${diagramUrl}" style="color: #2563eb; word-break: break-all;">${diagramUrl}</a>
              </p>

              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 16px;">
                  If you weren't expecting this, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                A product built with love by <a href="https://www.shipsar.in" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">Shipsar Developers</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"FlowCraft" <${user}>`,
    to,
    subject,
    html,
  });
}

export async function sendMentionEmail({
  to,
  diagramTitle,
  diagramUrl,
  mentionedByName,
  commentText,
}: {
  to: string;
  diagramTitle: string;
  diagramUrl: string;
  mentionedByName: string;
  commentText: string;
}): Promise<void> {
  const subject = `${mentionedByName} mentioned you in "${diagramTitle}"`;
  // Comment text is user-authored — escape before interpolating into HTML.
  const escapedText = commentText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You were mentioned</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #7c3aed); text-align: center; line-height: 48px; font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                      ⚡
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">FlowCraft</h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Visual Diagram & System Design Studio</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">You were mentioned in a comment</h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #475569;">
                <strong>${mentionedByName}</strong> mentioned you on <strong>"${diagramTitle}"</strong>:
              </p>

              <div style="background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #334155; white-space: pre-wrap;">${escapedText}</p>
              </div>

              <div style="text-align: center; margin: 28px 0;">
                <a href="${diagramUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                  View Comment
                </a>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${diagramUrl}" style="color: #2563eb; word-break: break-all;">${diagramUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                A product built with love by <a href="https://www.shipsar.in" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">Shipsar Developers</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"FlowCraft" <${user}>`,
    to,
    subject,
    html,
  });
}
