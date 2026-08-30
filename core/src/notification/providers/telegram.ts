/**
 * Telegram Notification Provider
 *
 * Sends notifications via Telegram Bot API.
 * Supports rate limiting and message formatting with severity emojis.
 *
 * Usage:
 *   const telegram = new TelegramProvider({ botToken, chatId });
 *   await telegram.send({ title: 'Alert', body: 'Service is down', severity: 'critical' });
 */

import type { NotificationPayload, NotificationSeverity, SendResult, NotificationProvider } from '../types.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

interface TelegramConfig {
  botToken: string;
  chatId: string;
  /** Parse mode for message formatting (Markdown, HTML, or empty) */
  parseMode?: 'Markdown' | 'HTML' | '';
  /** Timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

const SEVERITY_EMOJIS: Record<string, string> = {
  critical: '🔴',
  error: '🔴',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TelegramProvider implements NotificationProvider {
  readonly name = 'telegram';
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly parseMode: string;
  private readonly timeoutMs: number;

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.parseMode = config.parseMode || '';
    this.timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * Send a notification via Telegram.
   * Formats message with severity emoji and timestamp.
   * Retries up to 3 times on failure.
   */
  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!this.botToken || !this.chatId) {
      return {
        success: false,
        provider: this.name,
        error: 'Missing botToken or chatId configuration',
      };
    }

    const message = this.formatMessage(payload);
    const url = `${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: message,
            parse_mode: this.parseMode || undefined,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            provider: this.name,
            messageId: data.result?.message_id?.toString(),
          };
        }

        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as any).description || `HTTP ${response.status}`;

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            provider: this.name,
            error: errorMessage,
          };
        }

        // Retry on server errors
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        return {
          success: false,
          provider: this.name,
          error: `Failed after ${MAX_RETRIES} retries: ${errorMessage}`,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          return {
            success: false,
            provider: this.name,
            error: `Timeout after ${MAX_RETRIES} attempts`,
          };
        }

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        return {
          success: false,
          provider: this.name,
          error: err.message || 'Unknown error',
        };
      }
    }

    return {
      success: false,
      provider: this.name,
      error: 'Unexpected failure',
    };
  }

  /**
   * Format notification payload into a Telegram message.
   * Includes severity emoji, title, body, and timestamp.
   */
  private formatMessage(payload: NotificationPayload): string {
    const severity = payload.severity || 'info';
    const emoji = SEVERITY_EMOJIS[severity] || '📢';
    const timestamp = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });

    const lines: string[] = [];

    // Title with emoji
    if (payload.title) {
      lines.push(`${emoji} ${payload.title}`);
    } else {
      lines.push(`${emoji} Notification`);
    }

    // Body
    if (payload.body) {
      lines.push('');
      lines.push(payload.body);
    }

    // Timestamp
    lines.push('');
    lines.push(`⏰ ${timestamp}`);

    return lines.join('\n');
  }

  /**
   * Send multiple notifications grouped into a single message.
   * Useful for batch alerts to avoid spam.
   */
  async sendGrouped(
    payloads: NotificationPayload[],
    groupTitle: string = 'Grouped Alerts',
  ): Promise<SendResult> {
    if (payloads.length === 0) {
      return { success: true, provider: this.name };
    }

    const timestamp = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });

    const lines: string[] = [`📋 *${groupTitle}*`, ''];

    for (const payload of payloads) {
      const severity = payload.severity || 'info';
      const emoji = SEVERITY_EMOJIS[severity] || '📢';
      const text = payload.title || payload.body || 'No content';
      lines.push(`${emoji} ${text}`);
    }

    lines.push('');
    lines.push(`⏰ ${timestamp}`);

    const message = lines.join('\n');

    // Temporarily override parse mode for grouped messages with Markdown
    const originalParseMode = this.parseMode;
    (this as any).parseMode = 'Markdown';

    const result = await this.send({ body: message });

    (this as any).parseMode = originalParseMode;

    return result;
  }
}

export default TelegramProvider;
