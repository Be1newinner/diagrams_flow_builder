export interface User {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDocument {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  refreshToken?: string | null;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  name: string;
  type: 'access';
  // Present only for tokens issued at login (not the long-lived MCP token,
  // which predates session tracking and stays exempt from it — see
  // resolveAuthUserId in lib/auth.ts). Identifies which session/device this
  // token belongs to, for the active-sessions list and revocation.
  jti?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  jti?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  needsVerification?: boolean;
  requiresTwoFactor?: boolean;
}
