import jwt from 'jsonwebtoken';
import type { PublicUser } from '../data/mockUsers';

const ACCESS_TOKEN_TTL = Number(process.env.JWT_ACCESS_TTL ?? 15 * 60); // seconds
const REFRESH_TOKEN_TTL = Number(process.env.JWT_REFRESH_TTL ?? 7 * 24 * 60 * 60); // seconds

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
}

const refreshStore = new Map<string, { userId: string; expiresAt: number }>();

export const issueTokens = (user: PublicUser): AuthTokens => {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

  refreshStore.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL * 1000,
  });

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL * 1000,
    refreshExpiresAt: Date.now() + REFRESH_TOKEN_TTL * 1000,
  };
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;
    return {
      userId: decoded.userId ?? decoded.sub ?? '',
      email: String(decoded.email ?? ''),
      role: String(decoded.role ?? 'learner'),
      organizationId: decoded.organizationId ? String(decoded.organizationId) : undefined,
    };
  } catch {
    return null;
  }
};

export const rotateRefreshToken = (refreshToken: string, user: PublicUser): AuthTokens | null => {
  try {
    jwt.verify(refreshToken, REFRESH_SECRET);
    const entry = refreshStore.get(refreshToken);
    if (!entry || entry.userId !== user.id) {
      return null;
    }
    refreshStore.delete(refreshToken);
    return issueTokens(user);
  } catch {
    return null;
  }
};

export const revokeRefreshToken = (refreshToken?: string): void => {
  if (!refreshToken) return;
  refreshStore.delete(refreshToken);
};

export const decodeRefreshToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as jwt.JwtPayload;
    return {
      userId: decoded.userId ?? decoded.sub ?? '',
      email: String(decoded.email ?? ''),
      role: String(decoded.role ?? 'learner'),
      organizationId: decoded.organizationId ? String(decoded.organizationId) : undefined,
    };
  } catch {
    return null;
  }
};
