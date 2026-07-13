/**
 * WebhookTracker — Track consecutive webhook failures per provider
 * Alert when failures exceed threshold (Req 7.5)
 *
 * In-memory tracking (single-process service).
 * Tracks consecutive failures and emits warnings when threshold is exceeded.
 */

export interface ProviderHealth {
  provider: string;
  consecutiveFailures: number;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  isHealthy: boolean;
}

export interface WebhookHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, ProviderHealth>;
  checkedAt: string;
}

const DEFAULT_ALERT_THRESHOLD = 3;

export class WebhookTracker {
  private failures: Map<string, number> = new Map();
  private lastFailureAt: Map<string, Date> = new Map();
  private lastSuccessAt: Map<string, Date> = new Map();
  private lastError: Map<string, string> = new Map();
  private alertThreshold: number;
  private monitoringEndpoint: string | null;

  constructor(options?: { alertThreshold?: number; monitoringEndpoint?: string | null }) {
    this.alertThreshold = options?.alertThreshold ?? DEFAULT_ALERT_THRESHOLD;
    this.monitoringEndpoint = options?.monitoringEndpoint ?? null;
  }

  /**
   * Record a successful webhook processing for a provider.
   * Resets the consecutive failure counter.
   */
  recordSuccess(provider: string): void {
    this.failures.set(provider, 0);
    this.lastSuccessAt.set(provider, new Date());
  }

  /**
   * Record a webhook processing failure for a provider.
   * Increments the consecutive failure counter and triggers alerting if threshold exceeded.
   */
  recordFailure(provider: string, error?: string): void {
    const current = this.failures.get(provider) || 0;
    const newCount = current + 1;
    this.failures.set(provider, newCount);
    this.lastFailureAt.set(provider, new Date());

    if (error) {
      this.lastError.set(provider, error);
    }

    if (newCount > this.alertThreshold) {
      this.emitAlert(provider, newCount, error);
    }
  }

  /**
   * Get the current consecutive failure count for a provider.
   */
  getFailureCount(provider: string): number {
    return this.failures.get(provider) || 0;
  }

  /**
   * Check if a provider is considered healthy (failures <= threshold).
   */
  isProviderHealthy(provider: string): boolean {
    return this.getFailureCount(provider) <= this.alertThreshold;
  }

  /**
   * Get health status for all tracked providers.
   */
  getHealthStatus(): WebhookHealthStatus {
    const providers: Record<string, ProviderHealth> = {};
    const allProviders = new Set([
      ...this.failures.keys(),
      ...this.lastSuccessAt.keys(),
    ]);

    for (const provider of allProviders) {
      const consecutiveFailures = this.failures.get(provider) || 0;
      providers[provider] = {
        provider,
        consecutiveFailures,
        lastFailureAt: this.lastFailureAt.get(provider) || null,
        lastSuccessAt: this.lastSuccessAt.get(provider) || null,
        lastError: this.lastError.get(provider) || null,
        isHealthy: consecutiveFailures <= this.alertThreshold,
      };
    }

    // Determine overall health
    const providerList = Object.values(providers);
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (providerList.some(p => !p.isHealthy)) {
      const unhealthyCount = providerList.filter(p => !p.isHealthy).length;
      overall = unhealthyCount === providerList.length ? 'unhealthy' : 'degraded';
    }

    return {
      overall,
      providers,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Reset tracker state (useful for testing).
   */
  reset(): void {
    this.failures.clear();
    this.lastFailureAt.clear();
    this.lastSuccessAt.clear();
    this.lastError.clear();
  }

  /**
   * Emit alert when consecutive failures exceed threshold.
   * Logs a warning and optionally POSTs to a monitoring endpoint.
   */
  private emitAlert(provider: string, failureCount: number, error?: string): void {
    console.warn(
      `[Webhook Alert] Provider "${provider}" has ${failureCount} consecutive failures (threshold: ${this.alertThreshold}). Last error: ${error || 'unknown'}`
    );

    // POST to monitoring endpoint if configured
    if (this.monitoringEndpoint) {
      this.postAlert(provider, failureCount, error).catch((err) => {
        console.error('[Webhook Alert] Failed to POST alert to monitoring endpoint:', err.message);
      });
    }
  }

  private async postAlert(provider: string, failureCount: number, error?: string): Promise<void> {
    if (!this.monitoringEndpoint) return;

    // Dynamic import to avoid circular dependency issues
    const axios = await import('axios');
    await axios.default.post(this.monitoringEndpoint, {
      type: 'webhook_failure_alert',
      provider,
      consecutiveFailures: failureCount,
      threshold: this.alertThreshold,
      lastError: error || null,
      timestamp: new Date().toISOString(),
    }, { timeout: 5000 });
  }
}

// Singleton instance for use across the payment service
export const webhookTracker = new WebhookTracker({
  alertThreshold: DEFAULT_ALERT_THRESHOLD,
  monitoringEndpoint: process.env.WEBHOOK_MONITORING_ENDPOINT || null,
});
