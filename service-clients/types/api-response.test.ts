/**
 * Unit tests for shared ApiResponse types and helpers.
 * Requirements:  Req 9.1, 9.3, 9.4
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  successResponse,
  errorResponse,
  DEFAULT_MESSAGES_VI,
  AUTH_INVALID_001,
  PAY_PROVIDER_001,
  NOTIF_RATE_001,
  UNKNOWN_500,
} from './api-response';

describe('ApiResponse types', () => {
  describe('AppError', () => {
    it('creates error with all fields specified', () => {
      const err = new AppError(
        'User not found',
        404,
        'AUTH_NOTFOUND_001',
        'Không tìm thấy người dùng.',
      );

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.message).toBe('User not found');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('AUTH_NOTFOUND_001');
      expect(err.message_vi).toBe('Không tìm thấy người dùng.');
      expect(err.name).toBe('AppError');
    });

    it('uses default statusCode 500 when not specified', () => {
      const err = new AppError('Something broke');

      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('UNKNOWN_500');
    });

    it('generates code from statusCode when code not provided', () => {
      const err = new AppError('Bad request', 400);

      expect(err.code).toBe('UNKNOWN_400');
    });

    it('uses default Vietnamese message from status code', () => {
      const err = new AppError('Unauthorized', 401);

      expect(err.message_vi).toBe('Bạn chưa đăng nhập.  Vui lòng đăng nhập để tiếp tục.');
    });

    it('uses generic fallback Vietnamese message for unknown status codes', () => {
      const err = new AppError('Teapot', 418);

      expect(err.message_vi).toBe('Đã có lỗi xảy ra.  Vui lòng thử lại.');
    });

    it('has proper stack trace', () => {
      const err = new AppError('Test error');

      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AppError');
    });
  });

  describe('successResponse', () => {
    it('wraps data in success response', () => {
      const result = successResponse({ id: '123', name: 'Nguyễn Văn A' });

      expect(result).toEqual({
        success: true,
        data: { id: '123', name: 'Nguyễn Văn A' },
      });
    });

    it('handles null data', () => {
      const result = successResponse(null);

      expect(result).toEqual({ success: true, data: null });
    });

    it('handles array data', () => {
      const result = successResponse([1, 2, 3]);

      expect(result).toEqual({ success: true, data: [1, 2, 3] });
    });
  });

  describe('errorResponse', () => {
    it('creates error response with all fields', () => {
      const result = errorResponse(
        'Invalid credentials',
        'AUTH_INVALID_001',
        'Thông tin đăng nhập không đúng.',
      );

      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials',
        code: 'AUTH_INVALID_001',
        message_vi: 'Thông tin đăng nhập không đúng.',
      });
    });

    it('creates error response with only message', () => {
      const result = errorResponse('Something went wrong');

      expect(result).toEqual({
        success: false,
        error: 'Something went wrong',
        code: undefined,
        message_vi: undefined,
      });
    });
  });

  describe('Error code constants', () => {
    it('follows the {SERVICE}_{CATEGORY}_{NUMBER} format', () => {
      const codePattern = /^[A-Z]+_[A-Z]+_\d{3}$/;

      expect(AUTH_INVALID_001).toMatch(codePattern);
      expect(PAY_PROVIDER_001).toMatch(codePattern);
      expect(NOTIF_RATE_001).toMatch(codePattern);
    });

    it('UNKNOWN codes follow {UNKNOWN}_{STATUSCODE} format', () => {
      expect(UNKNOWN_500).toBe('UNKNOWN_500');
    });
  });

  describe('DEFAULT_MESSAGES_VI', () => {
    it('has Vietnamese messages for common HTTP status codes', () => {
      expect(DEFAULT_MESSAGES_VI[400]).toBeDefined();
      expect(DEFAULT_MESSAGES_VI[401]).toBeDefined();
      expect(DEFAULT_MESSAGES_VI[403]).toBeDefined();
      expect(DEFAULT_MESSAGES_VI[404]).toBeDefined();
      expect(DEFAULT_MESSAGES_VI[500]).toBeDefined();
    });

    it('messages are in Vietnamese', () => {
      // Check for Vietnamese-specific characters
      expect(DEFAULT_MESSAGES_VI[401]).toContain('đăng nhập');
      expect(DEFAULT_MESSAGES_VI[404]).toContain('Không tìm thấy');
      expect(DEFAULT_MESSAGES_VI[500]).toContain('lỗi');
    });
  });
});
