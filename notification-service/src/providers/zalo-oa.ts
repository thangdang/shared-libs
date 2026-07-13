/**
 * Zalo OA Provider — Send messages via Zalo Official Account API.
 * Used by all 6 products for Vietnamese-market push via Zalo.
 */

import type { NotificationResult } from '../types.js';

interface ZaloPayload {
  zaloUserId: string;
  text: string;
  deepLink?: string;
}

const ZALO_OA_API = 'https://openapi.zalo.me/v3.0/oa/message/cs';

export class ZaloOAProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Send text message to a Zalo user via Official Account.
   */
  async send(payload: ZaloPayload): Promise<NotificationResult> {
    if (!this.accessToken) {
      return { success: false, channel: 'zalo', error: 'Zalo OA token not configured' };
    }

    try {
      const body: any = {
        recipient: { user_id: payload.zaloUserId },
        message: { text: payload.text },
      };

      // Add action button if deep link provided
      if (payload.deepLink) {
        body.message = {
          text: payload.text,
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              buttons: [{
                title: 'Xem chi tiết',
                type: 'oa.open.url',
                payload: { url: payload.deepLink },
              }],
            },
          },
        };
      }

      const response = await fetch(ZALO_OA_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.accessToken,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error === 0) {
        return { success: true, channel: 'zalo', messageId: data.data?.message_id };
      }

      return { success: false, channel: 'zalo', error: `Zalo API error ${data.error}: ${data.message}` };
    } catch (err: any) {
      return { success: false, channel: 'zalo', error: err.message };
    }
  }

  /**
   * Send rich card message (image + title + description + CTA button).
   */
  async sendRichCard(params: {
    zaloUserId: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    buttonTitle: string;
    buttonUrl: string;
  }): Promise<NotificationResult> {
    if (!this.accessToken) {
      return { success: false, channel: 'zalo', error: 'Zalo OA token not configured' };
    }

    try {
      const body = {
        recipient: { user_id: params.zaloUserId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'list',
              elements: [{
                title: params.title,
                subtitle: params.subtitle,
                image_url: params.imageUrl,
                default_action: { type: 'oa.open.url', url: params.buttonUrl },
              }],
              buttons: [{
                title: params.buttonTitle,
                type: 'oa.open.url',
                payload: { url: params.buttonUrl },
              }],
            },
          },
        },
      };

      const response = await fetch(ZALO_OA_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': this.accessToken,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return data.error === 0
        ? { success: true, channel: 'zalo', messageId: data.data?.message_id }
        : { success: false, channel: 'zalo', error: `${data.error}: ${data.message}` };
    } catch (err: any) {
      return { success: false, channel: 'zalo', error: err.message };
    }
  }
}
