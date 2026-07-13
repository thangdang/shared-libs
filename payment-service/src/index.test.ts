/**
 * Unit tests for payment-service index.ts — Req 9.2
 * Verifies that sharedErrorHandler and notFoundHandler middleware
 * are correctly integrated into the Express app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing the module
vi.mock('express', () => {
  const useFn = vi.fn();
  const getFn = vi.fn();
  const listenFn = vi.fn((_port: number, cb?: () => void) => cb?.());
  const jsonMiddleware = vi.fn();
  const app = { use: useFn, get: getFn, listen: listenFn };

  const express: any = vi.fn(() => app);
  express.json = vi.fn(() => jsonMiddleware);

  return { default: express, __app: app };
});

vi.mock('cors', () => ({ default: vi.fn(() => 'cors-middleware') }));
vi.mock('helmet', () => ({ default: vi.fn(() => 'helmet-middleware') }));
vi.mock('mongoose', () => ({
  default: { connect: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
vi.mock('./routes/payment.routes', () => ({ paymentRoutes: 'payment-routes' }));
vi.mock('./routes/webhook.routes', () => ({ webhookRoutes: 'webhook-routes' }));
vi.mock('./routes/admin.routes', () => ({ adminRoutes: 'admin-routes' }));
vi.mock('../../service-clients/middleware/error-handler', () => ({
  sharedErrorHandler: 'shared-error-handler-middleware',
  notFoundHandler: 'not-found-handler-middleware',
}));

describe('payment-service index', () => {
  let app: { use: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to trigger module execution
    const express = await import('express');
    app = (express as any).__app;
  });

  it('should import sharedErrorHandler from service-clients', async () => {
    const errorHandler = await import('../../service-clients/middleware/error-handler');
    expect(errorHandler.sharedErrorHandler).toBe('shared-error-handler-middleware');
  });

  it('should import notFoundHandler from service-clients', async () => {
    const errorHandler = await import('../../service-clients/middleware/error-handler');
    expect(errorHandler.notFoundHandler).toBe('not-found-handler-middleware');
  });

  it('should register notFoundHandler and sharedErrorHandler via app.use', async () => {
    // Re-import the index module to trigger the app setup
    await import('./index');

    const useCalls = app.use.mock.calls.map((call: any[]) => call[0] ?? call[1]);

    // Verify notFoundHandler is registered
    expect(useCalls).toContain('not-found-handler-middleware');

    // Verify sharedErrorHandler is registered
    expect(useCalls).toContain('shared-error-handler-middleware');
  });

  it('should register notFoundHandler before sharedErrorHandler', async () => {
    await import('./index');

    const useCalls = app.use.mock.calls.map((call: any[]) => call[0] ?? call[1]);

    const notFoundIndex = useCalls.indexOf('not-found-handler-middleware');
    const errorHandlerIndex = useCalls.indexOf('shared-error-handler-middleware');

    expect(notFoundIndex).toBeGreaterThan(-1);
    expect(errorHandlerIndex).toBeGreaterThan(-1);
    expect(notFoundIndex).toBeLessThan(errorHandlerIndex);
  });

  it('should register sharedErrorHandler as the last middleware', async () => {
    await import('./index');

    const useCalls = app.use.mock.calls.map((call: any[]) => call[0] ?? call[1]);
    const lastMiddleware = useCalls[useCalls.length - 1];

    expect(lastMiddleware).toBe('shared-error-handler-middleware');
  });

  it('should register route handlers before error handling middleware', async () => {
    await import('./index');

    const useCalls = app.use.mock.calls;
    const flatArgs = useCalls.map((call: any[]) => call[call.length - 1]);

    const paymentRoutesIndex = flatArgs.indexOf('payment-routes');
    const notFoundIndex = flatArgs.indexOf('not-found-handler-middleware');

    expect(paymentRoutesIndex).toBeGreaterThan(-1);
    expect(notFoundIndex).toBeGreaterThan(-1);
    expect(paymentRoutesIndex).toBeLessThan(notFoundIndex);
  });
});
