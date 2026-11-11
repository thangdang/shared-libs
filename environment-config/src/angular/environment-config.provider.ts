/**
 * Angular Environment Config Provider - Nov 2026 Release
 * 
 * Provider configuration for Angular applications.
 * 
 * Usage in app.config.ts:
 * ```typescript
 * import { provideEnvironmentConfig } from '@shared/environment-config/angular';
 * import { environment } from './environments/environment';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideEnvironmentConfig({
 *       app: 'trendbrief',
 *       environment: environment.production ? 'production' : 'development',
 *     }),
 *   ],
 * };
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { InjectionToken, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { AppName, Environment, FrontendConfig } from '../types';
import { createFrontendConfig } from '../defaults';

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface EnvironmentConfigOptions {
  /** Which app is using this configuration */
  app: AppName;
  
  /** Current environment */
  environment: Environment;
  
  /** Custom overrides */
  overrides?: Partial<FrontendConfig>;
}

export const ENVIRONMENT_CONFIG = new InjectionToken<FrontendConfig>(
  'ENVIRONMENT_CONFIG'
);

// ═══════════════════════════════════════════════════════════════
//  PROVIDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Provide environment configuration for Angular app
 * 
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideEnvironmentConfig } from '@shared/environment-config/angular';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideEnvironmentConfig({ app: 'trendbrief', environment: 'production' }),
 *   ],
 * };
 * ```
 */
export function provideEnvironmentConfig(options: EnvironmentConfigOptions): EnvironmentProviders {
  const config = createFrontendConfig(options.app, options.environment);
  const finalConfig = options.overrides 
    ? { ...config, ...options.overrides }
    : config;

  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_CONFIG,
      useValue: finalConfig,
    },
  ]);
}

// ═══════════════════════════════════════════════════════════════
//  APP-SPECIFIC PROVIDERS
// ═══════════════════════════════════════════════════════════════

export function provideTrendBriefConfig(env: Environment, overrides?: Partial<FrontendConfig>): EnvironmentProviders {
  return provideEnvironmentConfig({ app: 'trendbrief', environment: env, overrides });
}

export function provideSmartBuyConfig(env: Environment, overrides?: Partial<FrontendConfig>): EnvironmentProviders {
  return provideEnvironmentConfig({ app: 'smartbuy', environment: env, overrides });
}

export function provideFinTaxConfig(env: Environment, overrides?: Partial<FrontendConfig>): EnvironmentProviders {
  return provideEnvironmentConfig({ app: 'fintax', environment: env, overrides });
}

export function provideDoctorCarConfig(env: Environment, overrides?: Partial<FrontendConfig>): EnvironmentProviders {
  return provideEnvironmentConfig({ app: 'doctorcar', environment: env, overrides });
}

export function provideCareMateConfig(env: Environment, overrides?: Partial<FrontendConfig>): EnvironmentProviders {
  return provideEnvironmentConfig({ app: 'caremate', environment: env, overrides });
}
