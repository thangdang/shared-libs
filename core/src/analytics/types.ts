export interface AnalyticsConfig {
  product: string;
  db: any; // Mongoose connection
  collectionPrefix?: string;
}

export interface AnalyticsEvent {
  product: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  properties?: Record<string, any>;
  timestamp: Date;
  platform?: 'web' | 'ios' | 'android' | 'zalo';
  ip?: string;
}

export interface RevenueEvent {
  product: string;
  stream: string; // 'affiliate' | 'premium' | 'ad' | 'commission' | 'referral' | 'report'
  amountVnd: number;
  amountUsd?: number;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export type HealthStatus = {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  product: string;
  uptime: number;
  dependencies: Record<string, 'ok' | 'down' | 'degraded'>;
};
