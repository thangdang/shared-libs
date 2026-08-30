/**
 * Token Service — JWT generation, verification, and refresh
 */
import jwt from 'jsonwebtoken';
import type { IUser, TokenPayload, AuthConfig } from '../types.js';

export interface TokenConfig {
  jwtSecret: string;
  jwtExpiresIn?: string;
}

/**
 * Generate a JWT token for a user.
 */
export function generateToken(
  user: IUser,
  config: TokenConfig
): string {
  const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    isPremium: !!user.premium_until && new Date(user.premium_until) > new Date(),
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn || '7d',
  });
}

/**
 * Verify a JWT token and return the payload.
 */
export function verifyToken(
  token: string,
  config: TokenConfig
): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT token without verification (for refresh scenarios).
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Refresh a JWT token.
 * Verifies the old token (ignoring expiration) and issues a new one.
 */
export async function refreshToken(
  token: string,
  getUserById: (id: string) => Promise<IUser | null>,
  config: TokenConfig
): Promise<string | null> {
  try {
    // Decode without verification (token might be expired)
    const decoded = jwt.verify(token, config.jwtSecret, {
      ignoreExpiration: true,
    }) as TokenPayload;

    const user = await getUserById(decoded.id);
    if (!user) return null;

    return generateToken(user, config);
  } catch {
    return null;
  }
}

/**
 * Token Service class for object-oriented usage.
 */
export class TokenService {
  private config: TokenConfig;

  constructor(config: TokenConfig) {
    this.config = config;
  }

  generate(user: IUser): string {
    return generateToken(user, this.config);
  }

  verify(token: string): TokenPayload | null {
    return verifyToken(token, this.config);
  }

  decode(token: string): TokenPayload | null {
    return decodeToken(token);
  }

  async refresh(
    token: string,
    getUserById: (id: string) => Promise<IUser | null>
  ): Promise<string | null> {
    return refreshToken(token, getUserById, this.config);
  }
}
