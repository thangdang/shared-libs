/**
 * @winlux/zalo-sdk
 *
 * Shared Zalo integration for all 6 WinLux products.
 * Provides: SSO login, OA messaging, share card builder, webhook handler.
 *
 * Usage:
 *   import { ZaloSSO, ZaloOA, ZaloShareCard } from '@winlux/zalo-sdk';
 *
 *   // SSO Login
 *   const sso = new ZaloSSO({ appId: '...', appSecret: '...' });
 *   const user = await sso.exchangeCode(authCode);
 *
 *   // OA Messaging
 *   const oa = new ZaloOA({ accessToken: '...' });
 *   await oa.sendText(userId, 'Xin chào!');
 *
 *   // Share Card
 *   const card = ZaloShareCard.build({ title: '...', image: '...', url: '...' });
 */

export { ZaloSSO } from './sso.js';
export { ZaloOA } from './oa.js';
export { ZaloShareCard } from './share-card.js';
export { ZaloWebhook } from './webhook.js';
export type { ZaloUser, ZaloConfig, ZaloShareData } from './types.js';
