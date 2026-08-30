/**
 * Shared Error Handler Middleware
 * ───────────────────────────────
 * Express middleware that catches errors and formats them as ApiResponse
 * with Vietnamese user-facing messages.
 *
 * Usage:
 * ```typescript
 * import { sharedErrorHandler } from '../middleware/error-handler';
 * app.use(sharedErrorHandler);
 * ```
 *
 * Requirements:  Req 9.2, 9.5
 */

import { ApiResponse, AppError, DEFAULT_MESSAGES_VI } from '../types/api-response';

/**
 * Express error-handling middleware.
 * Catches all errors thrown or passed via `next(err)` and formats them
 * as a consistent `ApiResponse` with a Vietnamese message.
 *
 * Supports:
 * - `AppError` instances (structured errors with code + message_vi)
 * - Standard `Error` instances (wrapped with generic code)
 * - Unknown error types (stringified)
 */
export function sharedErrorHandler(err: any, req: any, res: any, next: any): void {
  // If headers are already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode: number = err.statusCode || err.status || 500;
  const message: string = err.message || 'Internal server error';
  const code: string = err.code || `UNKNOWN_${statusCode}`;
  const message_vi: string =
    err.message_vi ||
    DEFAULT_MESSAGES_VI[statusCode] ||
    'Đã có lỗi xảy ra.  Vui lòng thử lại.';

  const response: ApiResponse = {
    success: false,
    error: message,
    code,
    message_vi,
  };

  res.status(statusCode).json(response);
}

/**
 * Async route handler wrapper.
 * Wraps an async Express route handler to automatically catch rejected promises
 * and pass them to the error-handling middleware.
 *
 * Usage:
 * ```typescript
 * import { asyncHandler } from '../middleware/error-handler';
 *
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.findAll();
 *   res.json({ success: true, data: users });
 * }));
 * ```
 */
export function asyncHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not-found handler middleware.
 * Place before `sharedErrorHandler` to catch unmatched routes.
 *
 * Usage:
 * ```typescript
 * app.use(notFoundHandler);
 * app.use(sharedErrorHandler);
 * ```
 */
export function notFoundHandler(req: any, res: any, next: any): void {
  const err = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'UNKNOWN_404',
    'Không tìm thấy đường dẫn yêu cầu.',
  );
  next(err);
}
