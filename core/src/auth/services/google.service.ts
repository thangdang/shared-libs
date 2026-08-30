/**
 * Google SSO Service — Verify Google ID tokens
 */
import axios from 'axios';
import type { GoogleUser, AuthConfig } from '../types.js';

/**
 * Verify a Google ID token and extract user info.
 *
 * @param idToken - Google ID token from client
 * @param config - Auth config with googleClientId
 * @returns Google user info or null if invalid
 */
export async function verifyGoogleToken(
  idToken: string,
  config?: Pick<AuthConfig, 'googleClientId'>
): Promise<GoogleUser | null> {
  try {
    const res = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    const data = res.data;

    // Verify audience matches our client ID (if provided)
    if (config?.googleClientId && data.aud !== config.googleClientId) {
      console.error('[Google] Token audience mismatch');
      return null;
    }

    if (!data.email_verified && data.email_verified !== 'true') {
      console.error('[Google] Email not verified');
      return null;
    }

    return {
      sub: data.sub,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture || '',
      email_verified: data.email_verified === 'true' || data.email_verified === true,
    };
  } catch (error: any) {
    console.error('[Google] Token verification failed:', error.message);
    return null;
  }
}

/**
 * Google SSO service class for object-oriented usage.
 */
export class GoogleService {
  private clientId?: string;

  constructor(config?: Pick<AuthConfig, 'googleClientId'>) {
    this.clientId = config?.googleClientId;
  }

  async verifyToken(idToken: string): Promise<GoogleUser | null> {
    return verifyGoogleToken(idToken, { googleClientId: this.clientId });
  }
}
