/**
 * Google SSO Service — Verify Google ID tokens
 */
import axios from 'axios';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

interface GoogleUser {
  sub: string;       // Google user ID
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUser | null> {
  try {
    // Verify token with Google's tokeninfo endpoint
    const res = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const data = res.data;

    // Verify audience matches our client ID
    if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) {
      console.error('[Google] Token audience mismatch');
      return null;
    }

    if (!data.email_verified) {
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
