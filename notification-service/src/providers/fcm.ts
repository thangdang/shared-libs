/**
 * FCM Push Provider — Firebase Cloud Messaging.
 * Used by all 6 products for mobile + web push notifications.
 */

import type { NotificationResult } from '../types.js';

interface FCMPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export class FCMProvider {
  private app: any = null;

  constructor(serviceAccount: object) {
    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        this.app = admin.app();
      }
    } catch (err: any) {
      console.warn('[NotificationService] Firebase Admin not available:', err.message);
    }
  }

  async send(payload: FCMPayload): Promise<NotificationResult> {
    if (!this.app) {
      return { success: false, channel: 'fcm', error: 'Firebase not initialized' };
    }

    try {
      const admin = require('firebase-admin');
      const messaging = admin.messaging();

      // In production: look up user's FCM token from DB
      // For now, send to topic (user subscribes to their own topic)
      const message = {
        topic: `user_${payload.userId}`,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: payload.data || {},
        android: {
          priority: 'high' as const,
          notification: { channelId: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      };

      const messageId = await messaging.send(message);
      return { success: true, channel: 'fcm', messageId };
    } catch (err: any) {
      return { success: false, channel: 'fcm', error: err.message };
    }
  }
}
