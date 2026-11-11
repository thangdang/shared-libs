/**
 * MoMo Payment Express Middleware - Nov 2026 Release
 * 
 * Express middleware for MoMo payment integration.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Request, Response, NextFunction } from 'express';
import { MoMoPaymentService, MoMoConfig } from './momo.service';
import type { MoMoIPNCallback } from '../types';

// ═══════════════════════════════════════════════════════════════
//  TYPE EXTENSIONS
// ═══════════════════════════════════════════════════════════════

declare global {
  namespace Express {
    interface Request {
      momoService?: MoMoPaymentService;
      momoIPNResult?: {
        success: boolean;
        orderId: string;
        transactionId: number;
        extraData: Record<string, unknown> | null;
        error?: string;
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Create MoMo middleware
 * 
 * Usage:
 * ```typescript
 * app.use(createMoMoMiddleware({
 *   partnerCode: process.env.MOMO_PARTNER_CODE!,
 *   accessKey: process.env.MOMO_ACCESS_KEY!,
 *   secretKey: process.env.MOMO_SECRET_KEY!,
 *   endpoint: 'https://payment.momo.vn/v2/gateway/api/create',
 *   ipnUrl: 'https://api.myapp.com/payment/momo/ipn',
 *   redirectUrl: 'https://myapp.com/payment/success',
 * }));
 * ```
 */
export function createMoMoMiddleware(config: MoMoConfig) {
  const service = new MoMoPaymentService(config);
  
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.momoService = service;
    next();
  };
}

// ═══════════════════════════════════════════════════════════════
//  IPN HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * MoMo IPN callback handler middleware
 * 
 * Usage:
 * ```typescript
 * app.post('/payment/momo/ipn',
 *   momoIPNHandler,
 *   async (req, res) => {
 *     const result = req.momoIPNResult;
 *     if (result?.success) {
 *       // Update subscription in database
 *       await activatePremium(result.extraData?.userId, result.orderId);
 *     }
 *     res.json({ message: 'ok' });
 *   }
 * );
 * ```
 */
export function momoIPNHandler(req: Request, res: Response, next: NextFunction): void {
  const callback = req.body as MoMoIPNCallback;
  
  if (!req.momoService) {
    res.status(500).json({ error: 'MoMo service not configured' });
    return;
  }
  
  // Validate required fields
  if (!callback.orderId || !callback.signature) {
    res.status(400).json({ error: 'Invalid IPN callback' });
    return;
  }
  
  // Process the callback
  const result = req.momoService.processIPNCallback(callback);
  req.momoIPNResult = result;
  
  // Log the result
  console.log('[MoMo IPN]', {
    orderId: result.orderId,
    transactionId: result.transactionId,
    success: result.success,
    error: result.error,
  });
  
  next();
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Create payment route handler
 * 
 * Usage:
 * ```typescript
 * app.post('/api/payment/create', createPaymentHandler);
 * ```
 */
export async function createPaymentHandler(req: Request, res: Response): Promise<void> {
  const { userId, app } = req.body;
  
  if (!req.momoService) {
    res.status(500).json({ error: 'MoMo service not configured' });
    return;
  }
  
  if (!userId || !app) {
    res.status(400).json({ error: 'Missing userId or app' });
    return;
  }
  
  try {
    const response = await req.momoService.createPremiumPayment(userId, app);
    
    if (response.resultCode === 0) {
      res.json({
        success: true,
        payUrl: response.payUrl,
        orderId: response.orderId,
        deeplink: response.deeplink,
        qrCodeUrl: response.qrCodeUrl,
      });
    } else {
      res.status(400).json({
        success: false,
        error: response.message,
        resultCode: response.resultCode,
      });
    }
  } catch (error) {
    console.error('[MoMo] Create payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment',
    });
  }
}

/**
 * Query payment status route handler
 */
export async function queryPaymentHandler(req: Request, res: Response): Promise<void> {
  const { orderId } = req.params;
  
  if (!req.momoService) {
    res.status(500).json({ error: 'MoMo service not configured' });
    return;
  }
  
  if (!orderId) {
    res.status(400).json({ error: 'Missing orderId' });
    return;
  }
  
  try {
    const status = await req.momoService.queryPaymentStatus(orderId);
    res.json({
      success: status.resultCode === 0,
      ...status,
    });
  } catch (error) {
    console.error('[MoMo] Query payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query payment',
    });
  }
}
