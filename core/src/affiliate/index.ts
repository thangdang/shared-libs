/**
 * Affiliate Module - Shared Library
 * 
 * Reusable affiliate integration for all 6 apps:
 * - SmartBuy, Video Engine, DoctorCar, CareMate, FinTax, TrendBrief
 * 
 * Each app has its own database, but uses this shared code.
 * 
 * Usage:
 * ```typescript
 * import { AffiliateService, MongoAffiliateRepository } from '@winlux/core/affiliate';
 * 
 * const db = mongoClient.db('smartbuy_db');
 * const repository = new MongoAffiliateRepository(db);
 * const affiliateService = new AffiliateService(repository, 'smartbuy');
 * ```
 */

export * from './types';
export * from './constants';
export * from './matcher';
export * from './link-generator';
export * from './tracker';
export * from './service';
export * from './repository';
export * from './routes';
