/**
 * Auth Microservice
 * ─────────────────
 * Shared authentication service for all WinLux products.
 * Handles: Email/Password, Google SSO, OTP (eSMS), JWT tokens
 *
 * Port: 4100
 * Internal only — called by product services via localhost
 *
 * Flow:
 *   Product UI → Product Service → Auth Service (verify/create user) → JWT
 *   Product Service validates JWT locally (shared secret)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { tokenRoutes } from './routes/token.routes';
import {
  ApiResponse,
  AppError,
  successResponse,
  errorResponse,
  errorHandler,
} from '../../service-clients/types/api-response';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4100;

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/users', userRoutes);
app.use('/api/auth/token', tokenRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', version: '1.0.0' });
});

// Shared error handler — must be AFTER all routes
app.use(errorHandler);

async function start() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/auth';
  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB connected');

  app.listen(PORT, () => {
    console.log(`✅ Auth Service running on :${PORT}`);
    console.log('   Methods: Email/Password, Google SSO, OTP (eSMS)');
  });
}

start().catch((err) => {
  console.error('❌ Auth Service failed to start:', err);
  process.exit(1);
});
