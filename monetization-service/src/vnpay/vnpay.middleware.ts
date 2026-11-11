/**
 * VNPay Express Middleware
 * Handles VNPay return URL and IPN callbacks
 */

import { Request, Response, NextFunction } from 'express';
import { VNPayService } from './vnpay.service';

/**
 * Extended request with VNPay verification result
 */
export interface VNPayRequest extends Request {
  vnpay?: {
    isValid: boolean;
    isSuccess: boolean;
    orderId: string;
    amount: number;
    message: string;
    transactionNo?: string;
    bankCode?: string;
    payDate?: string;
  };
}

/**
 * Middleware to verify VNPay return URL parameters
 * Use on the return URL endpoint
 */
export function vnpayReturnHandler(vnpayService: VNPayService) {
  return (req: VNPayRequest, res: Response, next: NextFunction) => {
    try {
      const result = vnpayService.verifyReturnUrl(req.query as Record<string, string>);

      req.vnpay = {
        isValid: result.isValid,
        isSuccess: result.isSuccess,
        orderId: result.orderId,
        amount: result.amount,
        message: result.message,
        transactionNo: result.data.vnp_TransactionNo,
        bankCode: result.data.vnp_BankCode,
        payDate: result.data.vnp_PayDate
      };

      next();
    } catch (error) {
      console.error('VNPay return verification error:', error);
      req.vnpay = {
        isValid: false,
        isSuccess: false,
        orderId: '',
        amount: 0,
        message: 'Verification error'
      };
      next();
    }
  };
}

/**
 * Middleware to handle VNPay IPN (webhook) callbacks
 * Use on the IPN endpoint
 */
export function vnpayIpnHandler(
  vnpayService: VNPayService,
  onSuccess: (orderId: string, amount: number, transactionNo: string) => Promise<boolean>,
  onFail?: (orderId: string, code: string, message: string) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    try {
      const result = vnpayService.verifyIpn(req.query as Record<string, string>);

      if (!result.isValid) {
        // Invalid checksum
        return res.status(200).json({
          RspCode: '97',
          Message: 'Checksum failed'
        });
      }

      const params = req.query;
      const orderId = params.vnp_TxnRef as string;
      const amount = parseInt(params.vnp_Amount as string) / 100;
      const transactionNo = params.vnp_TransactionNo as string;

      if (result.rspCode === '00') {
        // Payment successful - update order in database
        const orderUpdated = await onSuccess(orderId, amount, transactionNo);

        if (orderUpdated) {
          return res.status(200).json({
            RspCode: '00',
            Message: 'Success'
          });
        } else {
          // Order not found or already processed
          return res.status(200).json({
            RspCode: '01',
            Message: 'Order not found'
          });
        }
      } else {
        // Payment failed
        if (onFail) {
          await onFail(orderId, result.rspCode, result.message);
        }

        return res.status(200).json({
          RspCode: '00',
          Message: 'Success' // Always return success to VNPay for failed payments
        });
      }
    } catch (error) {
      console.error('VNPay IPN error:', error);
      return res.status(200).json({
        RspCode: '99',
        Message: 'Unknown error'
      });
    }
  };
}

/**
 * Create payment initiation endpoint handler
 */
export function vnpayCreatePaymentHandler(vnpayService: VNPayService) {
  return (req: Request, res: Response) => {
    try {
      const { orderId, amount, orderInfo, bankCode } = req.body;

      if (!orderId || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: orderId, amount'
        });
      }

      // Get client IP
      const ipAddr = (
        req.headers['x-forwarded-for'] as string ||
        req.socket.remoteAddress ||
        '127.0.0.1'
      ).split(',')[0].trim();

      const paymentUrl = vnpayService.createPaymentUrl({
        orderId,
        amount,
        orderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`,
        bankCode,
        ipAddr
      });

      return res.json({
        success: true,
        paymentUrl
      });
    } catch (error) {
      console.error('VNPay create payment error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment URL'
      });
    }
  };
}

/**
 * Create Express router configuration for VNPay endpoints
 */
export function createVNPayRouterConfig(
  vnpayService: VNPayService,
  options: {
    onPaymentSuccess: (orderId: string, amount: number, transactionNo: string) => Promise<boolean>;
    onPaymentFail?: (orderId: string, code: string, message: string) => Promise<void>;
    successRedirect: string;
    failRedirect: string;
  }
) {
  return {
    routes: [
      {
        method: 'POST',
        path: '/create-payment',
        handler: vnpayCreatePaymentHandler(vnpayService)
      },
      {
        method: 'GET',
        path: '/return',
        handlers: [
          vnpayReturnHandler(vnpayService),
          (req: VNPayRequest, res: Response) => {
            if (req.vnpay?.isSuccess) {
              res.redirect(`${options.successRedirect}?orderId=${req.vnpay.orderId}`);
            } else {
              res.redirect(`${options.failRedirect}?error=${encodeURIComponent(req.vnpay?.message || 'Payment failed')}`);
            }
          }
        ]
      },
      {
        method: 'GET',
        path: '/ipn',
        handler: vnpayIpnHandler(
          vnpayService,
          options.onPaymentSuccess,
          options.onPaymentFail
        )
      }
    ]
  };
}
