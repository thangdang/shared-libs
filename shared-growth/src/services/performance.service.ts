/**
 * Performance Service - Shared across all 5 apps
 * Handles performance monitoring, optimization, and reporting
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  LCP: number;  // Largest Contentful Paint (ms)
  FID: number;  // First Input Delay (ms)
  CLS: number;  // Cumulative Layout Shift
  
  // Additional metrics
  TTFB: number; // Time to First Byte (ms)
  FCP: number;  // First Contentful Paint (ms)
  TTI: number;  // Time to Interactive (ms)
  TBT: number;  // Total Blocking Time (ms)
  
  // Custom metrics
  apiResponseTime: number;
  jsHeapSize?: number;
  domNodes?: number;
  resourceCount?: number;
}

export interface PerformanceThresholds {
  LCP: { good: number; needsImprovement: number };
  FID: { good: number; needsImprovement: number };
  CLS: { good: number; needsImprovement: number };
  TTFB: { good: number; needsImprovement: number };
  FCP: { good: number; needsImprovement: number };
}

export interface PerformanceReport {
  appId: string;
  url: string;
  timestamp: Date;
  metrics: Partial<PerformanceMetrics>;
  scores: {
    overall: number;
    coreWebVitals: number;
    performance: number;
  };
  recommendations: string[];
}

export class PerformanceService {
  private readonly thresholds: PerformanceThresholds = {
    LCP: { good: 2500, needsImprovement: 4000 },
    FID: { good: 100, needsImprovement: 300 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    TTFB: { good: 800, needsImprovement: 1800 },
    FCP: { good: 1800, needsImprovement: 3000 }
  };

  /**
   * Calculate performance score from metrics
   */
  calculateScore(metrics: Partial<PerformanceMetrics>): number {
    let totalScore = 0;
    let weightedCount = 0;

    const weights = {
      LCP: 25,
      FID: 25,
      CLS: 25,
      FCP: 15,
      TTFB: 10
    };

    for (const [metric, weight] of Object.entries(weights)) {
      const value = metrics[metric as keyof PerformanceMetrics];
      if (value !== undefined) {
        const score = this.getMetricScore(metric, value);
        totalScore += score * weight;
        weightedCount += weight;
      }
    }

    return weightedCount > 0 ? Math.round(totalScore / weightedCount) : 0;
  }

  /**
   * Get score for a single metric (0-100)
   */
  private getMetricScore(metric: string, value: number): number {
    const threshold = this.thresholds[metric as keyof PerformanceThresholds];
    if (!threshold) return 50;

    if (value <= threshold.good) {
      return 100 - (value / threshold.good) * 10;
    } else if (value <= threshold.needsImprovement) {
      return 90 - ((value - threshold.good) / (threshold.needsImprovement - threshold.good)) * 40;
    } else {
      return Math.max(0, 50 - ((value - threshold.needsImprovement) / threshold.needsImprovement) * 50);
    }
  }

  /**
   * Get performance rating for a metric
   */
  getMetricRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[metric as keyof PerformanceThresholds];
    if (!threshold) return 'needs-improvement';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Generate performance recommendations based on metrics
   */
  generateRecommendations(metrics: Partial<PerformanceMetrics>): string[] {
    const recommendations: string[] = [];

    // LCP recommendations
    if (metrics.LCP && metrics.LCP > this.thresholds.LCP.good) {
      recommendations.push('Tối ưu hóa hình ảnh lớn nhất trên trang (LCP)');
      recommendations.push('Sử dụng lazy loading cho hình ảnh ngoài viewport');
      recommendations.push('Preload các resource quan trọng');
    }

    // FID recommendations
    if (metrics.FID && metrics.FID > this.thresholds.FID.good) {
      recommendations.push('Giảm thời gian thực thi JavaScript');
      recommendations.push('Tách code thành các chunk nhỏ hơn');
      recommendations.push('Sử dụng web workers cho các tác vụ nặng');
    }

    // CLS recommendations
    if (metrics.CLS && metrics.CLS > this.thresholds.CLS.good) {
      recommendations.push('Thêm kích thước cố định cho hình ảnh và iframe');
      recommendations.push('Tránh chèn nội dung động phía trên nội dung hiện có');
      recommendations.push('Sử dụng font-display: swap cho web fonts');
    }

    // TTFB recommendations
    if (metrics.TTFB && metrics.TTFB > this.thresholds.TTFB.good) {
      recommendations.push('Tối ưu hóa server response time');
      recommendations.push('Sử dụng CDN để giảm độ trễ');
      recommendations.push('Implement caching strategies');
    }

    // FCP recommendations
    if (metrics.FCP && metrics.FCP > this.thresholds.FCP.good) {
      recommendations.push('Loại bỏ render-blocking resources');
      recommendations.push('Inline critical CSS');
      recommendations.push('Defer non-critical JavaScript');
    }

    // General recommendations
    if (metrics.domNodes && metrics.domNodes > 1500) {
      recommendations.push('Giảm số lượng DOM nodes (hiện tại: ' + metrics.domNodes + ')');
    }

    if (metrics.resourceCount && metrics.resourceCount > 50) {
      recommendations.push('Giảm số lượng HTTP requests');
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  generateReport(
    appId: string,
    url: string,
    metrics: Partial<PerformanceMetrics>
  ): PerformanceReport {
    const overallScore = this.calculateScore(metrics);
    
    // Core Web Vitals score (LCP, FID, CLS)
    const coreMetrics = {
      LCP: metrics.LCP,
      FID: metrics.FID,
      CLS: metrics.CLS
    };
    const coreWebVitalsScore = this.calculateScore(coreMetrics);

    return {
      appId,
      url,
      timestamp: new Date(),
      metrics,
      scores: {
        overall: overallScore,
        coreWebVitals: coreWebVitalsScore,
        performance: overallScore
      },
      recommendations: this.generateRecommendations(metrics)
    };
  }

  /**
   * Generate client-side performance monitoring script
   */
  generateMonitoringScript(appId: string, endpoint: string): string {
    return `
(function() {
  const appId = '${appId}';
  const endpoint = '${endpoint}';
  
  function sendMetrics(metrics) {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify({ appId, ...metrics }));
    } else {
      fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ appId, ...metrics }),
        keepalive: true
      }).catch(() => {});
    }
  }

  // Observe LCP
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    sendMetrics({ LCP: lastEntry.startTime });
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // Observe FID
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach(entry => {
      sendMetrics({ FID: entry.processingStart - entry.startTime });
    });
  }).observe({ type: 'first-input', buffered: true });

  // Observe CLS
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    entries.forEach(entry => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });
  }).observe({ type: 'layout-shift', buffered: true });

  // Send CLS on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendMetrics({ CLS: clsValue });
    }
  });

  // Send navigation timing
  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = performance.getEntriesByType('navigation')[0];
      if (timing) {
        sendMetrics({
          TTFB: timing.responseStart,
          FCP: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
          domNodes: document.getElementsByTagName('*').length
        });
      }
    }, 0);
  });
})();
`;
  }

  /**
   * Generate image optimization recommendations
   */
  getImageOptimizationTips(): string[] {
    return [
      'Sử dụng format WebP hoặc AVIF cho hình ảnh',
      'Implement responsive images với srcset',
      'Lazy load hình ảnh ngoài viewport',
      'Nén hình ảnh với chất lượng phù hợp (80-85%)',
      'Sử dụng CDN cho hình ảnh',
      'Preload hình ảnh LCP',
      'Thêm width và height attributes để tránh CLS'
    ];
  }

  /**
   * Generate JavaScript optimization recommendations
   */
  getJSOptimizationTips(): string[] {
    return [
      'Code splitting theo routes',
      'Tree shaking để loại bỏ dead code',
      'Defer non-critical scripts',
      'Sử dụng async cho external scripts',
      'Minify và compress JavaScript',
      'Cache static assets với service worker',
      'Sử dụng web workers cho heavy computation'
    ];
  }

  /**
   * Generate CSS optimization recommendations
   */
  getCSSOptimizationTips(): string[] {
    return [
      'Inline critical CSS',
      'Preload important stylesheets',
      'Remove unused CSS',
      'Minify CSS',
      'Sử dụng CSS containment',
      'Tránh @import trong CSS',
      'Sử dụng font-display: swap'
    ];
  }
}

export const performanceService = new PerformanceService();
