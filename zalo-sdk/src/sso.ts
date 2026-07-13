/**
 * ZaloSSO — Zalo Social Login for all WinLux products.
 *
 * Flow: User clicks "Login with Zalo" → redirect to Zalo auth → get code → exchange for token → get profile.
 */

import type { ZaloConfig, ZaloUser } from './types.js';

const ZALO_OAUTH_URL = 'https://oauth.zaloapp.com/v4/permission';
const ZALO_TOKEN_URL = 'https://oauth.zaloapp.com/v4/access_token';
const ZALO_PROFILE_URL = 'https://graph.zalo.me/v2.0/me';

export class ZaloSSO {
  private config: ZaloConfig;

  constructor(config: ZaloConfig) {
    this.config = config;
  }

  /**
   * Generate Zalo OAuth login URL.
   * Redirect user to this URL to initiate login.
   */
  getLoginUrl(state?: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      redirect_uri: this.config.callbackUrl || '',
      state: state || '',
    });
    return `${ZALO_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token + user profile.
   */
  async exchangeCode(code: string): Promise<{ accessToken: string; user: ZaloUser }> {
    // Step 1: Exchange code for token
    const tokenResponse = await fetch(ZALO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(`Zalo token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    const accessToken = tokenData.access_token;

    // Step 2: Get user profile
    const user = await this.getProfile(accessToken);

    return { accessToken, user };
  }

  /**
   * Get user profile from access token.
   */
  async getProfile(accessToken: string): Promise<ZaloUser> {
    const response = await fetch(`${ZALO_PROFILE_URL}?fields=id,name,picture`, {
      headers: { access_token: accessToken },
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Zalo profile error: ${data.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      avatar: data.picture?.data?.url,
    };
  }

  /**
   * Refresh access token (tokens expire after a period).
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch(ZALO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }
}
