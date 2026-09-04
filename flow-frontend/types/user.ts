export interface User {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  avatarUrl?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AccessTokenPayload {
  userId: string;
  email: string;
  name: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  needsVerification?: boolean;
}
