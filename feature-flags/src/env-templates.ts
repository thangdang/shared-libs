/**
 * Environment Templates for Feature Flags
 * Task: SHARED-004
 * 
 * Templates for .env.nov2026 files
 * All AI features = false
 */

/**
 * Generate .env content for an app
 */
export function generateEnvTemplate(app: 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate'): string {
  const templates: Record<string, string> = {
    trendbrief: `# ============================================================
# TrendBrief Feature Flags - Nov 2026 Go-Live
# ============================================================
# AI features: DISABLED (set to false)
# Non-AI features: ENABLED (set to true)
# ============================================================

# ----- AI Features (DISABLED) -----
FEATURE_TRENDBRIEF_AI_SUMMARIZE_URL=false
FEATURE_TRENDBRIEF_AI_DAILY_BRIEFING=false
FEATURE_TRENDBRIEF_AI_TEXT_TO_SPEECH=false
FEATURE_TRENDBRIEF_AI_SMART_SEARCH=false

# ----- Non-AI Features (ENABLED) -----
FEATURE_TRENDBRIEF_RSS_HEADLINES=true
FEATURE_TRENDBRIEF_BREAKING_NEWS=true
FEATURE_TRENDBRIEF_TRENDING_TOPICS=true
FEATURE_TRENDBRIEF_NEWS_CATEGORIES=true

# ----- Global Features -----
FEATURE_GLOBAL_PREMIUM_SUBSCRIPTION=true
FEATURE_GLOBAL_REFERRAL_PROGRAM=true
FEATURE_GLOBAL_GAMIFICATION=true
FEATURE_GLOBAL_SOCIAL_SHARING=true
FEATURE_GLOBAL_PUSH_NOTIFICATIONS=true
FEATURE_GLOBAL_EMAIL_MARKETING=true
FEATURE_GLOBAL_ADSENSE=true
FEATURE_GLOBAL_ANALYTICS=true
`,
    smartbuy: `# ============================================================
# SmartBuy Feature Flags - Nov 2026 Go-Live
# ============================================================
# AI features: DISABLED (set to false)
# Non-AI features: ENABLED (set to true)
# Main revenue app - affiliate links enabled
# ============================================================

# ----- AI Features (DISABLED) -----
FEATURE_SMARTBUY_AI_CHAT_QUERY=false
FEATURE_SMARTBUY_AI_STREAM_QUERY=false
FEATURE_SMARTBUY_AI_VOICE_SEARCH=false
FEATURE_SMARTBUY_AI_PRODUCT_RECOMMENDATIONS=false

# ----- Non-AI Features (ENABLED) -----
FEATURE_SMARTBUY_PRICE_COMPARISON=true
FEATURE_SMARTBUY_PRICE_HISTORY=true
FEATURE_SMARTBUY_FLASH_SALES=true
FEATURE_SMARTBUY_PRICE_ALERTS=true
FEATURE_SMARTBUY_AFFILIATE_LINKS=true

# ----- Global Features -----
FEATURE_GLOBAL_PREMIUM_SUBSCRIPTION=true
FEATURE_GLOBAL_REFERRAL_PROGRAM=true
FEATURE_GLOBAL_GAMIFICATION=true
FEATURE_GLOBAL_SOCIAL_SHARING=true
FEATURE_GLOBAL_PUSH_NOTIFICATIONS=true
FEATURE_GLOBAL_EMAIL_MARKETING=true
FEATURE_GLOBAL_ADSENSE=true
FEATURE_GLOBAL_ANALYTICS=true
`,
    fintax: `# ============================================================
# FinTax Feature Flags - Nov 2026 Go-Live
# ============================================================
# AI features: DISABLED (set to false)
# Rule-based alternatives: ENABLED
# ============================================================

# ----- AI Features (DISABLED) -----
FEATURE_FINTAX_AI_CHAT=false
FEATURE_FINTAX_AI_TAX_ADVISOR=false
FEATURE_FINTAX_AI_RECEIPT_OCR=false
FEATURE_FINTAX_AI_CLASSIFICATION=false

# ----- Non-AI Features (ENABLED) -----
FEATURE_FINTAX_PIT_CALCULATOR=true
FEATURE_FINTAX_EXPENSE_TRACKER=true
FEATURE_FINTAX_TAX_FAQ=true
FEATURE_FINTAX_TAX_TIPS=true
FEATURE_FINTAX_KEYWORD_CLASSIFICATION=true
FEATURE_FINTAX_ANOMALY_DETECTION=true

# ----- Global Features -----
FEATURE_GLOBAL_PREMIUM_SUBSCRIPTION=true
FEATURE_GLOBAL_REFERRAL_PROGRAM=true
FEATURE_GLOBAL_GAMIFICATION=true
FEATURE_GLOBAL_SOCIAL_SHARING=true
FEATURE_GLOBAL_PUSH_NOTIFICATIONS=true
FEATURE_GLOBAL_EMAIL_MARKETING=true
FEATURE_GLOBAL_ADSENSE=true
FEATURE_GLOBAL_ANALYTICS=true
`,
    doctorcar: `# ============================================================
# DoctorCar Feature Flags - Nov 2026 Go-Live
# ============================================================
# AI features: DISABLED (set to false)
# Content-first approach: ENABLED
# ============================================================

# ----- AI Features (DISABLED) -----
FEATURE_DOCTORCAR_AI_DIAGNOSIS=false
FEATURE_DOCTORCAR_AI_IMAGE_ANALYSIS=false
FEATURE_DOCTORCAR_AI_SYMPTOM_CHAT=false

# ----- Non-AI Features (ENABLED) -----
FEATURE_DOCTORCAR_DTC_LOOKUP=true
FEATURE_DOCTORCAR_DTC_SEARCH=true
FEATURE_DOCTORCAR_MAINTENANCE_SCHEDULES=true
FEATURE_DOCTORCAR_FORUM_CONTENT=true
FEATURE_DOCTORCAR_CAR_SELECTOR=true

# ----- Global Features -----
FEATURE_GLOBAL_PREMIUM_SUBSCRIPTION=true
FEATURE_GLOBAL_REFERRAL_PROGRAM=true
FEATURE_GLOBAL_GAMIFICATION=true
FEATURE_GLOBAL_SOCIAL_SHARING=true
FEATURE_GLOBAL_PUSH_NOTIFICATIONS=true
FEATURE_GLOBAL_EMAIL_MARKETING=true
FEATURE_GLOBAL_ADSENSE=true
FEATURE_GLOBAL_ANALYTICS=true
`,
    caremate: `# ============================================================
# CareMate Feature Flags - Nov 2026 Go-Live
# ============================================================
# AI features: DISABLED (set to false)
# Safety features: ALWAYS ENABLED
# CRITICAL: disclaimer MUST always be true
# ============================================================

# ----- AI Features (DISABLED) -----
FEATURE_CAREMATE_AI_SYMPTOM_CHECKER=false
FEATURE_CAREMATE_AI_DRUG_SUGGESTIONS=false
FEATURE_CAREMATE_AI_HEALTH_CHAT=false

# ----- Non-AI Features (ENABLED) -----
FEATURE_CAREMATE_DRUG_SEARCH=true
FEATURE_CAREMATE_DRUG_DETAILS=true
FEATURE_CAREMATE_CONDITION_BROWSER=true
FEATURE_CAREMATE_HEALTH_ARTICLES=true
FEATURE_CAREMATE_PHARMACY_PRICES=true

# ----- Safety Features (ALWAYS ENABLED) -----
# DO NOT set this to false - legal requirement
FEATURE_CAREMATE_DISCLAIMER=true

# ----- Global Features -----
FEATURE_GLOBAL_PREMIUM_SUBSCRIPTION=true
FEATURE_GLOBAL_REFERRAL_PROGRAM=true
FEATURE_GLOBAL_GAMIFICATION=true
FEATURE_GLOBAL_SOCIAL_SHARING=true
FEATURE_GLOBAL_PUSH_NOTIFICATIONS=true
FEATURE_GLOBAL_EMAIL_MARKETING=true
FEATURE_GLOBAL_ADSENSE=true
FEATURE_GLOBAL_ANALYTICS=true
`
  };

  return templates[app] || '';
}

/**
 * Generate all .env templates
 */
export function generateAllEnvTemplates(): Record<string, string> {
  return {
    'trendbrief/.env.nov2026': generateEnvTemplate('trendbrief'),
    'smartbuy/.env.nov2026': generateEnvTemplate('smartbuy'),
    'fintax/.env.nov2026': generateEnvTemplate('fintax'),
    'doctorcar/.env.nov2026': generateEnvTemplate('doctorcar'),
    'caremate/.env.nov2026': generateEnvTemplate('caremate')
  };
}

/**
 * Feature flag documentation
 */
export const FEATURE_FLAG_DOCS = `
# Feature Flags Documentation

## Overview
Feature flags control which features are visible to users.
For Nov 2026 go-live, ALL AI features are disabled.

## Flag Format
Environment variable format: FEATURE_<APP>_<FEATURE>=true|false

## AI Features (Disabled Nov 2026)
These features require AI processing and are disabled until infrastructure is ready:

### TrendBrief
- ai_summarize_url: URL content summarization
- ai_daily_briefing: AI-generated daily briefing
- ai_text_to_speech: Text-to-speech conversion
- ai_smart_search: AI-powered semantic search

### SmartBuy
- ai_chat_query: AI shopping assistant chat
- ai_stream_query: Streaming AI responses
- ai_voice_search: Voice-based product search
- ai_product_recommendations: AI recommendations

### FinTax
- ai_chat: AI tax advisor chat
- ai_tax_advisor: AI tax optimization
- ai_receipt_ocr: AI receipt scanning
- ai_classification: AI expense categorization

### DoctorCar
- ai_diagnosis: AI car diagnosis
- ai_image_analysis: AI damage/part analysis
- ai_symptom_chat: AI symptom discussion

### CareMate
- ai_symptom_checker: AI symptom analysis
- ai_drug_suggestions: AI drug recommendations
- ai_health_chat: AI health assistant

## Non-AI Features (Enabled Nov 2026)
These features work without AI and are enabled by default.

## Safety Notes
- CareMate disclaimer: MUST always be true (legal requirement)
- Never expose AI features without proper testing
- Use requireFeature() middleware for API endpoints
- Use *featureFlag directive for UI elements
`;
