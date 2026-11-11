/**
 * SHARED-002:  Shared Feature Flag Middleware
 * Middleware to check feature flags and return 503 for disabled features
 */

import { Request, Response, NextFunction } from 'express';

export interface FeatureFlagService {
  isEnabled(featureName: string): Promise<boolean> | boolean;
}

export interface RequireFeatureOptions {
  featureService: FeatureFlagService;
  featureName: string;
  errorMessage?: string;
  logDisabled?: boolean;
}

/**
 * Express middleware factory for feature flag checks
 * Returns 503 Service Unavailable when feature is disabled
 */
export function requireFeature(options: RequireFeatureOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isEnabled = await options.featureService.isEnabled(options.featureName);
      
      if (!isEnabled) {
        if (options.logDisabled !== false) {
          console.log(`[FeatureFlag] Blocked request to disabled feature: ${options.featureName}`);
        }
        
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: options.errorMessage || `Tính năng "${options.featureName}" hiện không khả dụng. Vui lòng thử lại sau.`,
          featureDisabled: true,
          featureName: options.featureName,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    } catch (error) {
      console.error(`[FeatureFlag] Error checking feature ${options.featureName}:`, error);
      // Default to disabled on error for safety
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Không thể kiểm tra trạng thái tính năng. Vui lòng thử lại sau.',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Higher-order function to create middleware for multiple features
 */
export function requireAnyFeature(options: {
  featureService: FeatureFlagService;
  featureNames: string[];
  errorMessage?: string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await Promise.all(
        options.featureNames.map(name => options.featureService.isEnabled(name))
      );
      
      const anyEnabled = results.some(r => r);
      
      if (!anyEnabled) {
        return res.status(503).json({
          success: false,
          error: 'SERVICE_UNAVAILABLE',
          message: options.errorMessage || 'Các tính năng yêu cầu hiện không khả dụng.',
          featureDisabled: true,
          featureNames: options.featureNames,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    } catch (error) {
      console.error('[FeatureFlag] Error checking features:', error);
      return res.status(503).json({
        success: false,
        error: 'SERVICE_UNAVAILABLE',
        message: 'Không thể kiểm tra trạng thái tính năng.',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Create a simple feature flag service from config
 */
export function createFeatureFlagService(config: Record<string, boolean>): FeatureFlagService {
  return {
    isEnabled(featureName: string): boolean {
      return config[featureName] ?? false;
    }
  };
}

/**
 * TB-003 to TB-006, SB-006, FT-003-006, DC-003-006, CM-003-006
 * Pre-configured disabled endpoint handlers
 */
export const disabledEndpointResponse = (featureName: string) => {
  return (_req: Request, res: Response) => {
    res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: `Tính năng "${featureName}" tạm thời không khả dụng.`,
      featureDisabled: true,
      featureName,
      timestamp: new Date().toISOString()
    });
  };
};

// Pre-configured handlers for each app's disabled AI endpoints
export const trendBriefDisabledEndpoints = {
  summarizeUrl: disabledEndpointResponse('ai_summarize_url'),
  briefing: disabledEndpointResponse('ai_briefing'),
  tts: disabledEndpointResponse('ai_tts')
};

export const smartBuyDisabledEndpoints = {
  aiQuery: disabledEndpointResponse('ai_query'),
  aiQueryStream: disabledEndpointResponse('ai_query_stream'),
  aiQueryVoice: disabledEndpointResponse('ai_query_voice')
};

export const finTaxDisabledEndpoints = {
  chat: disabledEndpointResponse('ai_chat'),
  chatStream: disabledEndpointResponse('ai_chat_stream'),
  taxAdvisor: disabledEndpointResponse('ai_tax_advisor')
};

export const doctorCarDisabledEndpoints = {
  diagnosisAnalyze: disabledEndpointResponse('ai_diagnosis_analyze'),
  diagnosisQuick: disabledEndpointResponse('ai_diagnosis_quick'),
  imageAnalysis: disabledEndpointResponse('ai_image_analysis')
};

export const careMateDisabledEndpoints = {
  checkSymptoms: disabledEndpointResponse('ai_check_symptoms'),
  suggestDrugs: disabledEndpointResponse('ai_suggest_drugs'),
  emergencyDetection: disabledEndpointResponse('ai_emergency_detection')
};

export default requireFeature;
