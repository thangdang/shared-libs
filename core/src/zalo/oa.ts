/**
 * ZaloOA — Zalo Official Account API client.
 * Send messages, manage followers, broadcast content.
 */

import type { ZaloOAConfig } from './types.js';

const ZALO_OA_API = 'https://openapi.zalo.me/v3.0/oa';

export class ZaloOA {
  private accessToken: string;

  constructor(config: ZaloOAConfig | string) {
    this.accessToken = typeof config === 'string' ? config : config.accessToken;
  }

  /**
   * Send text message to a Zalo user.
   */
  async sendText(userId: string, text: string): Promise<boolean> {
    return this.sendMessage(userId, { text });
  }

  /**
   * Send message with action button.
   */
  async sendWithButton(userId: string, text: string, buttonTitle: string, url: string): Promise<boolean> {
    return this.sendMessage(userId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          buttons: [{ title: buttonTitle, type: 'oa.open.url', payload: { url } }],
          text,
        },
      },
    });
  }

  /**
   * Send rich list message (multiple items with images).
   */
  async sendList(userId: string, elements: Array<{
    title: string;
    subtitle: string;
    imageUrl?: string;
    url?: string;
  }>): Promise<boolean> {
    return this.sendMessage(userId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'list',
          elements: elements.map(el => ({
            title: el.title,
            subtitle: el.subtitle,
            image_url: el.imageUrl,
            default_action: el.url ? { type: 'oa.open.url', url: el.url } : undefined,
          })),
        },
      },
    });
  }

  /**
   * Get OA follower info.
   */
  async getFollowerInfo(userId: string): Promise<any> {
    const response = await fetch(`${ZALO_OA_API}/getprofile?data={"user_id":"${userId}"}`, {
      headers: { access_token: this.accessToken },
    });
    return response.json();
  }

  private async sendMessage(userId: string, message: any): Promise<boolean> {
    try {
      const response = await fetch(`${ZALO_OA_API}/message/cs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.accessToken,
        },
        body: JSON.stringify({
          recipient: { user_id: userId },
          message,
        }),
      });

      const data = await response.json();
      return data.error === 0;
    } catch {
      return false;
    }
  }
}
