/**
 * Unit tests for shared error handler middleware.
 * Requirements:  Req 9.2, 9.5
 */

import { describe, it, expect, vi } from 'vitest';
import { sharedErrorHandler, asyncHandler, notFoundHandler } from './error-handler';
import { AppError } from '../types/api-response';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockReq(overrides: any = {}) {
  return {
    method: 'GET',
    originalUrl: '/test',
    ...overrides,
  };
}

function createMockRes() {
  const res: any = {
    headersSent: false,
    statusCode: 200,
    body: null,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: any) => {
    res.body = data;
    return res;
  });
  return res;
}

// ─── sharedErrorHandler Tests ────────────────────────────────────────────────

describe('sharedErrorHandler', () => {
  it('formats AppError with all fields', () => {
    const err = new AppError(
      'User not found',
      404,
      'AUTH_NOTFOUND_001',
      'Không tìm thấy người dùng.',
    );
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: 'User not found',
      code: 'AUTH_NOTFOUND_001',
      message_vi: 'Không tìm thấy người dùng.',
    });
  });

  it('handles plain Error with default values', () => {
    const err = new Error('Something went wrong');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Something went wrong',
      code: 'UNKNOWN_500',
      message_vi: 'Đã có lỗi xảy ra.  Vui lòng thử lại.',
    });
  });

  it('uses err.statusCode when available', () => {
    const err: any = new Error('Bad request');
    err.statusCode = 400;
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body!.code).toBe('UNKNOWN_400');
    expect(res.body!.message_vi).toBe('Dữ liệu không hợp lệ.  Vui lòng kiểm tra lại.');
  });

  it('uses err.status as fallback for statusCode', () => {
    const err: any = new Error('Forbidden');
    err.status = 403;
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('delegates to next() if headers already sent', () => {
    const err = new AppError('Error', 500);
    const req = createMockReq();
    const res = createMockRes();
    res.headersSent = true;
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('handles error objects with custom code and message_vi', () => {
    const err: any = new Error('Provider timeout');
    err.statusCode = 502;
    err.code = 'PAY_PROVIDER_001';
    err.message_vi = 'Nhà cung cấp thanh toán không phản hồi.';
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.body).toEqual({
      success: false,
      error: 'Provider timeout',
      code: 'PAY_PROVIDER_001',
      message_vi: 'Nhà cung cấp thanh toán không phản hồi.',
    });
  });

  it('handles unknown error shape gracefully', () => {
    const err: any = { statusCode: 422, message: 'Validation failed' };
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body!.success).toBe(false);
    expect(res.body!.error).toBe('Validation failed');
  });

  it('always returns success: false', () => {
    const err = new AppError('Test', 500);
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    sharedErrorHandler(err, req, res, next);

    expect(res.body!.success).toBe(false);
  });
});

// ─── asyncHandler Tests ──────────────────────────────────────────────────────

describe('asyncHandler', () => {
  it('passes resolved handler through without error', async () => {
    const handler = asyncHandler(async (req, res) => {
      res.json({ success: true });
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('catches rejected promises and passes error to next()', async () => {
    const error = new AppError('Async failure', 500);
    const handler = asyncHandler(async () => {
      throw error;
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

// ─── notFoundHandler Tests ───────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('creates AppError with 404 and passes to next()', () => {
    const req = createMockReq({ method: 'POST', originalUrl: '/api/unknown' });
    const res = createMockRes();
    const next = vi.fn();

    notFoundHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const passedError = next.mock.calls[0][0];
    expect(passedError).toBeInstanceOf(AppError);
    expect(passedError.statusCode).toBe(404);
    expect(passedError.code).toBe('UNKNOWN_404');
    expect(passedError.message).toContain('POST /api/unknown');
    expect(passedError.message_vi).toBe('Không tìm thấy đường dẫn yêu cầu.');
  });
});
