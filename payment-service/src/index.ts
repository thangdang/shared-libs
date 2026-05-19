/**
 * Payment Microservice
 * ────────────────────
 * Shared payment service for all WinLux products.
 * Handles: SePay (default), MoMo, ZaloPay, payOS, Stripe
 *
 * Port: 3006
 * Internal only — called by product services via localhost
 * Webhooks exposed via Nginx: api.winlux.com/payment/*
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { paymentRoutes } from './routes/payment.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { adminRoutes } from './routes/admin.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors({ origin: '*' })); // Internal service — allow all
app.use(express.json());

// Routes
app.use('/api/payment', paymentRoutes);
app.use('/api/payment/webhook', webhookRoutes);
app.use('/api/payment/admin', adminRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'payment-service', version: '1.0.0' });
});

// Connect DB and start
async function start() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment';
  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB connected');

  app.listen(PORT, () => {
    console.log(`✅ Payment Service running on :${PORT}`);
    console.log('   Providers: SePay (default), MoMo, ZaloPay, payOS, Stripe');
  });
}

start().catch((err) => {
  console.error('❌ Payment Service failed to start:', err);
  process.exit(1);
});
