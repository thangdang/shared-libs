/**
 * Angular Analytics Module - Nov 2026 Release
 * 
 * Angular-specific analytics service and directives.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

export { AnalyticsService } from './analytics.service';
export { provideAnalytics, ANALYTICS_CONFIG } from './analytics.provider';
export type { AnalyticsProviderConfig } from './analytics.provider';

// Directives
export {
  TrackClickDirective,
  TrackExternalClickDirective,
  TrackViewDirective,
  TrackShareDirective,
} from './analytics.directive';
