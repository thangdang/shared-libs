/**
 * ZaloWebhook — Handle incoming Zalo OA webhook events.
 * Base class that products extend with their own event handlers.
 */

export interface ZaloWebhookEvent {
  app_id: string;
  user_id_by_app: string;
  event_name: string;
  timestamp: string;
  message?: {
    msg_id: string;
    text?: string;
    attachments?: any[];
  };
  follower?: {
    id: string;
  };
  info?: any;
}

export type WebhookHandler = (event: ZaloWebhookEvent) => Promise<void>;

export class ZaloWebhook {
  private handlers: Map<string, WebhookHandler[]> = new Map();

  /**
   * Register a handler for a specific event type.
   * Event types: 'user_send_text', 'follow', 'unfollow', 'user_click_item'
   */
  on(eventName: string, handler: WebhookHandler): void {
    const existing = this.handlers.get(eventName) || [];
    existing.push(handler);
    this.handlers.set(eventName, existing);
  }

  /**
   * Process an incoming webhook event.
   * Call this from your Express route handler.
   *
   * Usage:
   *   app.post('/webhook/zalo', (req, res) => {
   *     webhook.process(req.body);
   *     res.json({ status: 'ok' });
   *   });
   */
  async process(body: ZaloWebhookEvent): Promise<void> {
    const handlers = this.handlers.get(body.event_name) || [];

    for (const handler of handlers) {
      try {
        await handler(body);
      } catch (err: any) {
        console.error(`[ZaloWebhook] Handler error for ${body.event_name}:`, err.message);
      }
    }
  }

  /**
   * Verify webhook signature (OA webhook verification).
   */
  static verifySignature(body: string, signature: string, oaSecret: string): boolean {
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', oaSecret)
      .update(body)
      .digest('hex');
    return expected === signature;
  }
}
