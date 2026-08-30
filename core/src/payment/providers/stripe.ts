/**
 * Stripe Payment Provider
 */
import type { WebhookVerifyResult } from '../types.js';

export interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Create a Stripe checkout session.
 */
export async function createStripeCheckout(
  orderId: string,
  amount: number,
  description: string,
  userEmail: string,
  metadata: Record<string, string>,
  config: StripeConfig
) {
  if (!config.secretKey) throw new Error('Stripe not configured');

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(config.secretKey);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: 'vnd',
          product_data: { name: description },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: { orderId, ...metadata },
    success_url: `${config.successUrl || ''}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.cancelUrl || '',
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Verify Stripe webhook.
 */
export async function verifyStripeWebhook(
  rawBody: Buffer,
  signature: string,
  config: StripeConfig
): Promise<WebhookVerifyResult> {
  if (!config.secretKey || !config.webhookSecret) {
    return { valid: false, orderId: '', success: false, transId: '', metadata: {} };
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(config.secretKey);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.webhookSecret
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      return {
        valid: true,
        orderId: session.metadata?.orderId || '',
        success: true,
        transId: session.payment_intent || '',
        metadata: session.metadata || {},
      };
    }
  } catch {
    // Invalid signature
  }

  return { valid: false, orderId: '', success: false, transId: '', metadata: {} };
}

/**
 * Stripe Provider class for object-oriented usage.
 */
export class StripeProvider {
  private config: StripeConfig;

  constructor(config: StripeConfig) {
    this.config = config;
  }

  async createCheckout(
    orderId: string,
    amount: number,
    description: string,
    userEmail: string,
    metadata: Record<string, string>
  ) {
    return createStripeCheckout(
      orderId,
      amount,
      description,
      userEmail,
      metadata,
      this.config
    );
  }

  async verifyWebhook(rawBody: Buffer, signature: string): Promise<WebhookVerifyResult> {
    return verifyStripeWebhook(rawBody, signature, this.config);
  }
}
