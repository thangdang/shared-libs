/**
 * Webhook Tracker — Track webhook health status per provider
 */

export interface ProviderHealth {
  consecutiveFailures: number;
  lastError?: string;
  lastErrorAt?: Date;
  lastSuccessAt?: Date;
}

export interface WebhookHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, ProviderHealth & { status: 'healthy' | 'degraded' | 'unhealthy' }>;
}

/**
 * Create a webhook tracker instance.
 */
export function createWebhookTracker() {
  const providerHealth: Record<string, ProviderHealth> = {};

  function recordSuccess(provider: string): void {
    if (!providerHealth[provider]) {
      providerHealth[provider] = { consecutiveFailures: 0 };
    }
    providerHealth[provider].consecutiveFailures = 0;
    providerHealth[provider].lastSuccessAt = new Date();
  }

  function recordFailure(provider: string, error: string): void {
    if (!providerHealth[provider]) {
      providerHealth[provider] = { consecutiveFailures: 0 };
    }
    providerHealth[provider].consecutiveFailures++;
    providerHealth[provider].lastError = error;
    providerHealth[provider].lastErrorAt = new Date();
  }

  function getHealthStatus(): WebhookHealthStatus {
    const providers: WebhookHealthStatus['providers'] = {};
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [provider, health] of Object.entries(providerHealth)) {
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (health.consecutiveFailures >= 5) {
        status = 'unhealthy';
        hasUnhealthy = true;
      } else if (health.consecutiveFailures >= 2) {
        status = 'degraded';
        hasDegraded = true;
      }

      providers[provider] = { ...health, status };
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthy) overall = 'unhealthy';
    else if (hasDegraded) overall = 'degraded';

    return { overall, providers };
  }

  function reset(provider?: string): void {
    if (provider) {
      delete providerHealth[provider];
    } else {
      for (const key of Object.keys(providerHealth)) {
        delete providerHealth[key];
      }
    }
  }

  return {
    recordSuccess,
    recordFailure,
    getHealthStatus,
    reset,
  };
}

/**
 * Webhook Tracker class for object-oriented usage.
 */
export class WebhookTracker {
  private tracker = createWebhookTracker();

  recordSuccess(provider: string): void {
    this.tracker.recordSuccess(provider);
  }

  recordFailure(provider: string, error: string): void {
    this.tracker.recordFailure(provider, error);
  }

  getHealthStatus(): WebhookHealthStatus {
    return this.tracker.getHealthStatus();
  }

  reset(provider?: string): void {
    this.tracker.reset(provider);
  }
}
