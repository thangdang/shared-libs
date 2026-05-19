/**
 * Shared Mongoose Connection Options
 *
 * Optimized connection pool settings for a 4GB VPS running multiple services.
 * Each service gets its own connection pool; these defaults balance throughput
 * with memory usage.
 *
 * Usage:
 *   import { MONGOOSE_OPTIONS, connectWithDefaults } from './mongoose-config';
 *
 *   // Option 1: Spread into mongoose.connect()
 *   await mongoose.connect(process.env.MONGODB_URI, MONGOOSE_OPTIONS);
 *
 *   // Option 2: Use helper with custom overrides
 *   await connectWithDefaults(process.env.MONGODB_URI, { maxPoolSize: 10 });
 *
 * Copy this file into any service that connects to MongoDB.
 * Only dependency: mongoose (already in all services).
 */

import mongoose, { ConnectOptions } from 'mongoose';

/**
 * Shared Mongoose connection options for all services.
 *
 * Rationale for each setting:
 *
 * - maxPoolSize: 20
 *   Maximum connections per service. On a 4GB VPS with 5 services,
 *   this gives up to 100 total connections (well within MongoDB limits).
 *   Increase only if you see "connection pool exhausted" warnings.
 *
 * - minPoolSize: 5
 *   Keep 5 connections warm to avoid cold-start latency on first requests
 *   after idle periods. Reduces connection establishment overhead.
 *
 * - maxIdleTimeMS: 30000 (30s)
 *   Close idle connections after 30 seconds to free resources.
 *   Balances between keeping connections warm and not wasting memory.
 *
 * - serverSelectionTimeoutMS: 5000 (5s)
 *   How long to wait for a suitable server before throwing an error.
 *   5s is enough for local/same-datacenter MongoDB; increase for remote.
 *
 * - socketTimeoutMS: 45000 (45s)
 *   How long a socket can be inactive before being closed.
 *   45s accommodates slow aggregation queries without holding dead sockets.
 *
 * - family: 4
 *   Force IPv4 to avoid DNS resolution delays on systems with broken IPv6.
 *   Most VPS providers route IPv4 faster than IPv6 for local connections.
 */
export const MONGOOSE_OPTIONS: ConnectOptions = {
  /** Maximum number of connections in the pool */
  maxPoolSize: 20,
  /** Minimum number of connections kept open */
  minPoolSize: 5,
  /** Close idle connections after 30 seconds */
  maxIdleTimeMS: 30000,
  /** Timeout for initial server selection */
  serverSelectionTimeoutMS: 5000,
  /** Timeout for socket inactivity */
  socketTimeoutMS: 45000,
  /** Force IPv4 to avoid IPv6 resolution delays */
  family: 4,
};

/**
 * Connect to MongoDB with shared defaults + optional overrides.
 *
 * @param uri - MongoDB connection string
 * @param overrides - Options to override defaults (shallow merge)
 * @returns Mongoose connection instance
 *
 * @example
 * // Basic connection with all defaults
 * await connectWithDefaults(process.env.MONGODB_URI);
 *
 * @example
 * // Smaller pool for a lightweight service
 * await connectWithDefaults(process.env.MONGODB_URI, {
 *   maxPoolSize: 10,
 *   minPoolSize: 2,
 * });
 */
export async function connectWithDefaults(
  uri: string,
  overrides: Partial<ConnectOptions> = {}
): Promise<typeof mongoose> {
  const options: ConnectOptions = {
    ...MONGOOSE_OPTIONS,
    ...overrides,
  };

  return mongoose.connect(uri, options);
}

/**
 * Recommended pool sizes per service type.
 * Use as reference when overriding maxPoolSize.
 *
 * Rationale:
 * - Heavy services (SmartBuy, TrendBrief): many concurrent queries → larger pool
 * - Light services (FIN Tax, Childhood): fewer concurrent users → smaller pool
 * - Background workers: mostly sequential → minimal pool
 */
export const POOL_SIZE_RECOMMENDATIONS = {
  /** High-traffic API services (SmartBuy, TrendBrief) */
  highTraffic: { maxPoolSize: 20, minPoolSize: 5 },
  /** Medium-traffic services (CareMate, FIN Tax) */
  mediumTraffic: { maxPoolSize: 15, minPoolSize: 3 },
  /** Low-traffic or background services (Childhood, workers) */
  lowTraffic: { maxPoolSize: 10, minPoolSize: 2 },
  /** Backoffice / admin services */
  admin: { maxPoolSize: 10, minPoolSize: 2 },
} as const;
