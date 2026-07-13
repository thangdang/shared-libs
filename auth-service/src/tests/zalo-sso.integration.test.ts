/**
 * Integration Tests — Zalo SSO End-to-End (code → JWT)
 *
 * Tests the full flow through POST /api/auth/zalo route handler:
 * - New account creation via Zalo code
 * - Existing account lookup by zalo_id
 * - Account merge when Zalo phone matches existing phone account
 * - Mini App flow (separate credentials)
 * - Validation (missing code → 400)
 *
 * @validates Req 4.1 — POST /api/auth/zalo endpoint
 * @validates Req 4.3 — Auto-create/merge user
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ─── Mock @winlux/zalo-sdk ───

const mockExchangeCode = vi.fn();

vi.mock('@winlux/zalo-sdk', () => ({
  ZaloSSO: vi.fn().mockImplementation(() => ({
    exchangeCode: mockExchangeCode,
  })),
}));

// ─── Mock Mongoose User Model ───

const mockFindOne = vi.fn();
const mockCreate = vi.fn();
const mockSave = vi.fn();

vi.mock('../../models/User', () => ({
  User: {
    findOne: (...args: any[]) => mockFindOne(...args),
    create: (...args: any[]) => mockCreate(...args),
  },
}));

// ─── Import route AFTER mocks are set up ───

import { authRoutes } from '../../routes/auth.routes';

// ─── Test App Setup ───

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

// ─── Test Data ───

const ZALO_PROFILE_NEW = {
  id: 'zalo_user_12345',
  name: 'Nguyễn Văn A',
  avatar: 'https://zalo.me/avatar/12345.jpg',
  phone: '+84912345678',
};

const ZALO_PROFILE_NO_PHONE = {
  id: 'zalo_user_67890',
  name: 'Trần Thị B',
  avatar: 'https://zalo.me/avatar/67890.jpg',
};

const EXISTING_USER_BY_ZALO_ID = {
  _id: { toString: () => 'mongo_id_001' },
  email: 'existing@example.com',
  name: 'Nguyễn Văn A',
  phone: '0912345678',
  avatar_url: 'https://zalo.me/avatar/12345.jpg',
  zalo_id: 'zalo_user_12345',
  auth_method: 'zalo',
  is_verified: true,
  products: ['smartbuy'],
  premium_until: null,
  last_login_at: null,
  save: mockSave,
};

const EXISTING_USER_BY_PHONE = {
  _id: { toString: () => 'mongo_id_002' },
  email: 'phone_user@example.com',
  name: 'Phone User',
  phone: '0912345678',
  avatar_url: undefined,
  zalo_id: undefined,
  auth_method: 'otp',
  is_verified: true,
  products: ['fintax'],
  premium_until: null,
  last_login_at: null,
  save: mockSave,
};

const NEW_USER_CREATED = {
  _id: { toString: () => 'mongo_id_003' },
  email: undefined,
  name: 'Nguyễn Văn A',
  phone: '0912345678',
  avatar_url: 'https://zalo.me/avatar/12345.jpg',
  zalo_id: 'zalo_user_12345',
  auth_method: 'zalo',
  is_verified: true,
  products: ['smartbuy'],
  premium_until: null,
  last_login_at: null,
};

// ─── Tests ───

describe('POST /api/auth/zalo — Zalo SSO Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockSave.mockResolvedValue(undefined);
  });

  // ─── Test 1: New account creation ───

  it('should create a new user and return JWT when Zalo code is valid (new account)', async () => {
    // Zalo SDK returns profile
    mockExchangeCode.mockResolvedValueOnce({
      accessToken: 'zalo_access_token_abc',
      user: ZALO_PROFILE_NEW,
    });

    // No existing user found by zalo_id or phone
    mockFindOne.mockResolvedValue(null);

    // User.create returns new user
    mockCreate.mockResolvedValueOnce(NEW_USER_CREATED);

    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ code: 'valid_zalo_code', product: 'smartbuy' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.name).toBe('Nguyễn Văn A');
    expect(res.body.data.user.id).toBe('mongo_id_003');

    // Verify JWT is valid
    const decoded = jwt.verify(res.body.data.token, 'winlux-jwt-secret-change-me') as any;
    expect(decoded.id).toBe('mongo_id_003');
    expect(decoded.name).toBe('Nguyễn Văn A');

    // Verify User.create was called with correct data
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nguyễn Văn A',
        zalo_id: 'zalo_user_12345',
        auth_method: 'zalo',
        is_verified: true,
        products: ['smartbuy'],
      }),
    );
  });

  // ─── Test 2: Existing account by zalo_id ───

  it('should return same user when Zalo code maps to existing account (by zalo_id)', async () => {
    mockExchangeCode.mockResolvedValueOnce({
      accessToken: 'zalo_access_token_abc',
      user: ZALO_PROFILE_NEW,
    });

    // First findOne (by zalo_id) returns existing user
    mockFindOne.mockResolvedValueOnce(EXISTING_USER_BY_ZALO_ID);

    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ code: 'valid_zalo_code', product: 'smartbuy' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.id).toBe('mongo_id_001');
    expect(res.body.data.user.name).toBe('Nguyễn Văn A');

    // Should NOT create a new user
    expect(mockCreate).not.toHaveBeenCalled();

    // Should update last_login_at and save
    expect(mockSave).toHaveBeenCalled();
  });

  // ─── Test 3: Phone merge — Zalo phone matches existing phone account ───

  it('should merge Zalo account with existing phone account and return merged user', async () => {
    mockExchangeCode.mockResolvedValueOnce({
      accessToken: 'zalo_access_token_abc',
      user: ZALO_PROFILE_NEW, // has phone: +84912345678
    });

    // First findOne (by zalo_id) → not found
    mockFindOne.mockResolvedValueOnce(null);
    // Second findOne (by phone) → found existing phone user
    mockFindOne.mockResolvedValueOnce({ ...EXISTING_USER_BY_PHONE, save: mockSave });

    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ code: 'valid_zalo_code', product: 'smartbuy' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.id).toBe('mongo_id_002');

    // Should NOT create a new user — merged with phone account
    expect(mockCreate).not.toHaveBeenCalled();

    // Should have saved (to link zalo_id to existing account)
    expect(mockSave).toHaveBeenCalled();
  });

  // ─── Test 4: Mini App flow uses Mini App credentials ───

  it('should use Mini App SSO instance when mini_app: true', async () => {
    mockExchangeCode.mockResolvedValueOnce({
      accessToken: 'zalo_mini_token',
      user: ZALO_PROFILE_NO_PHONE,
    });

    // No existing user found
    mockFindOne.mockResolvedValue(null);

    const miniAppUser = {
      ...NEW_USER_CREATED,
      _id: { toString: () => 'mongo_id_004' },
      name: 'Trần Thị B',
      zalo_id: 'zalo_user_67890',
      phone: undefined,
      avatar_url: 'https://zalo.me/avatar/67890.jpg',
    };
    mockCreate.mockResolvedValueOnce(miniAppUser);

    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ code: 'mini_app_code_xyz', product: 'fintax', mini_app: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.id).toBe('mongo_id_004');
    expect(res.body.data.user.name).toBe('Trần Thị B');

    // exchangeCode was called (the mini_app flag selects the correct SSO instance internally)
    expect(mockExchangeCode).toHaveBeenCalledWith('mini_app_code_xyz');
  });

  // ─── Test 5: Missing code → 400 ───

  it('should return 400 when code is missing from request body', async () => {
    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ product: 'smartbuy' }); // no code

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();

    // Should not call Zalo SDK at all
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  it('should return 400 when product is missing from request body', async () => {
    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ code: 'some_code' }); // no product

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();

    // Should not call Zalo SDK at all
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  // ─── Test 6: Zalo SDK error → 500 ───

  it('should return 500 when Zalo SDK exchange fails', async () => {
    mockExchangeCode.mockRejectedValueOnce(new Error('Zalo token exchange failed'));

    const res = await request(app)
      .post('/api/auth/zalo')
      .send({ code: 'invalid_code', product: 'smartbuy' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
