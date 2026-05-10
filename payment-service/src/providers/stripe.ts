const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || '';
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || '';

export async function createStripeCheckout(orderId: string, amount: number, description: string, userEmail: string, metadata: Record<string, string>) {
  if (!STRIPE_SECRET_KEY) throw new Error('Stripe not configured');

  const Stripe = require('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    line_items: [{
      price_data: {
        currency: 'vnd',
        product_data: { name: description },
        unit_amount: amount,
      },
      quantity: 1,
    }],
    metadata: { orderId, ...metadata },
    success_url: `${STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: STRIPE_CANCEL_URL,
  });

  return { sessionId: session.id, url: session.url };
}

export function verifyStripeWebhook(rawBody: Buffer, signature: string): { valid: boolean; orderId: string; success: boolean; transId: string; metadata: Record<string, string> } {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return { valid: false, orderId: '', success: false, transId: '', metadata: {} };
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      return {
        valid: true,
        orderId: session.metadata.orderId || '',
        success: true,
        transId: session.payment_intent || '',
        metadata: session.metadata || {},
      };
    }
  } catch { /* invalid signature */ }

  return { valid: false, orderId: '', success: false, transId: '', metadata: {} };
}
