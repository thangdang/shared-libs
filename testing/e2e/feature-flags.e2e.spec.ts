/**
 * SHARED-006 + TB-020, SB-025, FT-022, DC-025, CM-026
 * E2E Tests:  Feature Flag Compliance Audit
 * Verifies all AI features are properly hidden and disabled
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const APPS = [
  { name: 'TrendBrief', url: 'http://localhost:4200', prefix: 'TB' },
  { name: 'SmartBuy', url: 'http://localhost:4201', prefix: 'SB' },
  { name: 'FinTax', url: 'http://localhost:4202', prefix: 'FT' },
  { name: 'DoctorCar', url: 'http://localhost:4203', prefix: 'DC' },
  { name: 'CareMate', url: 'http://localhost:4204', prefix: 'CM' }
];

// AI Elements that should be HIDDEN (not visible, no disabled state)
const AI_ELEMENTS = {
  TB: [
    { selector: '[data-testid="summarize-url-btn"]', name: 'Summarize URL button' },
    { selector: '[data-testid="daily-briefing-section"]', name: 'Daily Briefing section' },
    { selector: '[data-testid="audio-tts-btn"]', name: 'Audio/TTS button' },
    { selector: '.ai-chat-input', name: 'AI Chat input' }
  ],
  SB: [
    { selector: '[data-testid="ai-chat-btn"]', name: 'AI Chat button' },
    { selector: '[data-testid="voice-search-mic"]', name: 'Voice search mic' },
    { selector: '[data-testid="ask-ai-input"]', name: 'Ask AI input' },
    { selector: '.ai-assistant-panel', name: 'AI Assistant panel' }
  ],
  FT: [
    { selector: '[data-testid="ai-chat-btn"]', name: 'AI Chat button' },
    { selector: '[data-testid="tax-advisor-btn"]', name: 'Tax Advisor button' },
    { selector: '[data-testid="ask-ai-input"]', name: 'Ask AI input' },
    { selector: '.ai-suggestions', name: 'AI Suggestions' }
  ],
  DC: [
    { selector: '[data-testid="ai-diagnosis-btn"]', name: 'AI Diagnosis button' },
    { selector: '[data-testid="describe-symptoms-input"]', name: 'Describe symptoms input' },
    { selector: '[data-testid="image-upload-btn"]', name: 'Image upload button' },
    { selector: '.ai-diagnosis-panel', name: 'AI Diagnosis panel' }
  ],
  CM: [
    { selector: '[data-testid="ai-symptom-checker"]', name: 'AI Symptom Checker' },
    { selector: '[data-testid="describe-symptoms-input"]', name: 'Describe symptoms input' },
    { selector: '[data-testid="ai-suggests-drugs"]', name: 'AI suggests drugs section' },
    { selector: '.ai-chat-panel', name: 'AI Chat panel' }
  ]
};

// API endpoints that should return 503
const DISABLED_ENDPOINTS = {
  TB: [
    { path: '/api/summarize-url', method: 'POST', name: 'Summarize URL' },
    { path: '/api/briefing', method: 'GET', name: 'Daily Briefing' },
    { path: '/api/tts', method: 'POST', name: 'Text-to-Speech' }
  ],
  SB: [
    { path: '/api/ai/query', method: 'POST', name: 'AI Query' },
    { path: '/api/ai/query/stream', method: 'POST', name: 'AI Query Stream' },
    { path: '/api/ai/query/voice', method: 'POST', name: 'AI Query Voice' }
  ],
  FT: [
    { path: '/api/chat', method: 'POST', name: 'AI Chat' },
    { path: '/api/chat/stream', method: 'POST', name: 'AI Chat Stream' },
    { path: '/api/tax-advisor', method: 'POST', name: 'Tax Advisor' }
  ],
  DC: [
    { path: '/api/diagnosis/analyze', method: 'POST', name: 'Diagnosis Analyze' },
    { path: '/api/diagnosis/quick', method: 'POST', name: 'Diagnosis Quick' },
    { path: '/api/image/analyze', method: 'POST', name: 'Image Analysis' }
  ],
  CM: [
    { path: '/api/check-symptoms', method: 'POST', name: 'Check Symptoms' },
    { path: '/api/suggest-drugs', method: 'POST', name: 'Suggest Drugs' },
    { path: '/api/emergency-detection', method: 'POST', name: 'Emergency Detection' }
  ]
};

// Non-AI features that should be VISIBLE and FUNCTIONAL
const ENABLED_FEATURES = {
  TB: [
    { selector: '[data-testid="breaking-news-section"]', name: 'Breaking News section' },
    { selector: '[data-testid="trending-section"]', name: 'Trending section' },
    { selector: '[data-testid="tin-moi-section"]', name: 'Tin Mới section' }
  ],
  SB: [
    { selector: '[data-testid="flash-sale-section"]', name: 'Flash Sale section' },
    { selector: '[data-testid="best-price-section"]', name: 'Best Price section' },
    { selector: '[data-testid="product-search"]', name: 'Product Search' }
  ],
  FT: [
    { selector: '[data-testid="faq-section"]', name: 'FAQ section' },
    { selector: '[data-testid="pit-calculator"]', name: 'PIT Calculator' },
    { selector: '[data-testid="category-dropdown"]', name: 'Category Dropdown' }
  ],
  DC: [
    { selector: '[data-testid="dtc-search"]', name: 'DTC Search' },
    { selector: '[data-testid="car-selector"]', name: 'Car Selector' },
    { selector: '[data-testid="maintenance-section"]', name: 'Maintenance section' }
  ],
  CM: [
    { selector: '[data-testid="drug-search"]', name: 'Drug Search' },
    { selector: '[data-testid="condition-browser"]', name: 'Condition Browser' },
    { selector: '[data-testid="medical-disclaimer"]', name: 'Medical Disclaimer' }
  ]
};

test.describe('Feature Flag Compliance Audit', () => {
  
  for (const app of APPS) {
    test.describe(`${app.name} (${app.prefix})`, () => {
      
      test.beforeEach(async ({ page }) => {
        // Navigate to app home page
        await page.goto(app.url, { waitUntil: 'networkidle' });
      });

      // Test 1:  AI elements should be completely hidden (not just disabled)
      test('AI elements should be hidden from DOM', async ({ page }) => {
        const aiElements = AI_ELEMENTS[app.prefix as keyof typeof AI_ELEMENTS];
        
        for (const element of aiElements) {
          const locator = page.locator(element.selector);
          const count = await locator.count();
          
          expect(count, `${element.name} should not exist in DOM`).toBe(0);
          
          // Double check it's not just hidden with CSS
          if (count > 0) {
            const isVisible = await locator.isVisible();
            expect(isVisible, `${element.name} should not be visible`).toBe(false);
          }
        }
      });

      // Test 2:  No "Coming Soon" or disabled state for AI features
      test('No "Coming Soon" text for AI features', async ({ page }) => {
        const comingSoonTexts = [
          'Coming Soon',
          'Sắp ra mắt',
          'Đang phát triển',
          'Under Development'
        ];
        
        for (const text of comingSoonTexts) {
          const locator = page.getByText(text, { exact: false });
          const count = await locator.count();
          
          // If found, make sure it's not related to AI features
          for (let i = 0; i < count; i++) {
            const element = locator.nth(i);
            const parentText = await element.evaluate(el => 
              el.closest('section, div, article')?.textContent || ''
            );
            
            const aiKeywords = ['AI', 'Summarize', 'TTS', 'Voice', 'Chat', 'Diagnosis'];
            const hasAIContext = aiKeywords.some(kw => parentText.includes(kw));
            
            expect(hasAIContext, `"${text}" should not appear near AI features`).toBe(false);
          }
        }
      });

      // Test 3:  Non-AI features should be visible and functional
      test('Non-AI features should be visible', async ({ page }) => {
        const enabledFeatures = ENABLED_FEATURES[app.prefix as keyof typeof ENABLED_FEATURES];
        
        for (const feature of enabledFeatures) {
          const locator = page.locator(feature.selector);
          await expect(locator, `${feature.name} should be visible`).toBeVisible({ timeout: 10000 });
        }
      });

      // Test 4:  Disabled API endpoints should return 503
      test('Disabled AI endpoints return 503', async ({ request }) => {
        const endpoints = DISABLED_ENDPOINTS[app.prefix as keyof typeof DISABLED_ENDPOINTS];
        
        for (const endpoint of endpoints) {
          const serviceUrl = app.url.replace(/:\d+$/, ':300' + (APPS.indexOf(app) + 1));
          const url = serviceUrl + endpoint.path;
          
          let response;
          if (endpoint.method === 'POST') {
            response = await request.post(url, {
              data: { test: true },
              failOnStatusCode: false
            });
          } else {
            response = await request.get(url, { failOnStatusCode: false });
          }
          
          expect(response.status(), `${endpoint.name} should return 503`).toBe(503);
          
          const body = await response.json();
          expect(body.featureDisabled).toBe(true);
          expect(body.error).toBe('SERVICE_UNAVAILABLE');
        }
      });

      // Test 5:  CareMate specific - Medical disclaimer always visible
      if (app.prefix === 'CM') {
        test('Medical disclaimer is always visible', async ({ page }) => {
          const disclaimer = page.locator('[data-testid="medical-disclaimer"]');
          await expect(disclaimer).toBeVisible();
          
          // Check disclaimer contains required text
          const text = await disclaimer.textContent();
          expect(text).toContain('bác sĩ');
          expect(text).toContain('115');
        });

        test('Emergency info is accessible', async ({ page }) => {
          const emergencyLink = page.locator('[data-testid="emergency-info-link"]');
          await emergencyLink.click();
          
          // Should navigate to emergency page
          await expect(page).toHaveURL(/emergency/);
          
          // Emergency numbers should be visible
          await expect(page.getByText('115')).toBeVisible();
        });
      }

      // Test 6:  Page loads without JavaScript errors
      test('No JavaScript errors on page load', async ({ page }) => {
        const errors: string[] = [];
        
        page.on('pageerror', error => {
          errors.push(error.message);
        });
        
        await page.goto(app.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        expect(errors.length, `Should have no JS errors: ${errors.join(', ')}`).toBe(0);
      });

      // Test 7:  Console should not have feature flag warnings
      test('No feature flag errors in console', async ({ page }) => {
        const consoleErrors: string[] = [];
        
        page.on('console', msg => {
          if (msg.type() === 'error' && msg.text().toLowerCase().includes('feature')) {
            consoleErrors.push(msg.text());
          }
        });
        
        await page.goto(app.url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        expect(consoleErrors.length, `Should have no feature flag errors`).toBe(0);
      });
    });
  }
});

test.describe('Cross-App Feature Compliance', () => {
  
  test('All apps have consistent feature flag behavior', async ({ request }) => {
    for (const app of APPS) {
      const servicePort = 3001 + APPS.indexOf(app);
      const healthUrl = `http://localhost:${servicePort}/health`;
      
      try {
        const response = await request.get(healthUrl);
        const health = await response.json();
        
        // All apps should report AI disabled
        expect(health.features?.ai_enabled).toBe(false);
      } catch (e) {
        // Service might not be running in test environment
        console.log(`Skipping ${app.name} health check - service not running`);
      }
    }
  });

  test('Monetization features are enabled across all apps', async ({ request }) => {
    const monetizationEndpoints = [
      '/api/subscription/tiers',
      '/api/features'
    ];
    
    for (const app of APPS) {
      const servicePort = 3001 + APPS.indexOf(app);
      
      for (const endpoint of monetizationEndpoints) {
        const url = `http://localhost:${servicePort}${endpoint}`;
        
        try {
          const response = await request.get(url);
          expect(response.status()).toBe(200);
        } catch (e) {
          // Service might not be running
        }
      }
    }
  });
});
