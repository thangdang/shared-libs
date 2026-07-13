/**
 * HealthChecker — Standardized health check response for all services.
 *
 * Returns consistent format:
 * { status, version, product, uptime, dependencies: { mongodb, redis, ollama } }
 */

import type { HealthStatus } from './types.js';

export class HealthChecker {
  private product: string;
  private version: string;
  private startTime: number;
  private checks: Map<string, () => Promise<boolean>> = new Map();

  constructor(product: string, version: string) {
    this.product = product;
    this.version = version;
    this.startTime = Date.now();
  }

  /**
   * Register a dependency check.
   * The checker function should return true if healthy, false otherwise.
   */
  register(name: string, checker: () => Promise<boolean>): void {
    this.checks.set(name, checker);
  }

  /**
   * Run all checks and return standardized health response.
   */
  async check(): Promise<HealthStatus> {
    const dependencies: Record<string, 'ok' | 'down' | 'degraded'> = {};
    let allOk = true;

    for (const [name, checker] of this.checks) {
      try {
        const healthy = await checker();
        dependencies[name] = healthy ? 'ok' : 'down';
        if (!healthy) allOk = false;
      } catch {
        dependencies[name] = 'down';
        allOk = false;
      }
    }

    return {
      status: allOk ? 'ok' : 'degraded',
      version: this.version,
      product: this.product,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      dependencies,
    };
  }
}
