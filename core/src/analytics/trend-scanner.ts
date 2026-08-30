/**
 * Vietnamese Trend Scanner
 *
 * Scans Vietnamese internet for trends via Google Trends.
 * Maps trends to relevant products using keyword matching.
 *
 * Migrated from shared-services/agent-orchestrator/agents/content_intelligence.py
 *
 * Usage:
 *   import { TrendScanner } from '@winlux/analytics';
 *
 *   const scanner = new TrendScanner({ mongoUri: 'mongodb://localhost:27017' });
 *   const trends = await scanner.fetchTrends();
 *   const mapped = scanner.mapToProducts(trends);
 */

import { MongoClient, Db } from 'mongodb';

// ─── Types ───

export interface Trend {
  title: string;
  rank: number;
  date: string;
  source: string;
  traffic?: string;
}

export interface TrendSuggestion {
  trend_title: string;
  trend_rank: number;
  trend_date: string;
  trend_source: string;
  product: string;
  status: 'pending' | 'reviewed' | 'used' | 'dismissed';
  suggested_at: Date;
  acted_on: boolean;
}

export interface TrendScannerConfig {
  mongoUri: string;
}

// ─── Product Keywords (Vietnamese) ───

const PRODUCT_KEYWORDS: Record<string, string[]> = {
  trendbriefai: [
    'tin tức', 'thời sự', 'công nghệ', 'tài chính', 'giải trí',
    'chính trị', 'xã hội', 'thế giới', 'việt nam', 'breaking',
  ],
  smartbuy: [
    'giảm giá', 'flash sale', 'mua sắm', 'điện thoại', 'laptop',
    'shopee', 'lazada', 'tiki', 'deal', 'khuyến mãi',
  ],
  fintax: [
    'thuế', 'tài chính', 'đầu tư', 'tiết kiệm', 'PIT',
    'chứng khoán', 'ngân hàng', 'lãi suất', 'crypto', 'bitcoin',
  ],
  caremate: [
    'sức khỏe', 'thuốc', 'bệnh', 'triệu chứng', 'nhà thuốc',
    'covid', 'dịch', 'vaccine', 'bệnh viện', 'y tế',
  ],
  childhood: [
    'tuổi thơ', 'trò chơi', 'kỷ niệm', 'nostalgia', '8x 9x',
    'hoạt hình', 'đồ chơi', 'truyện tranh', 'game cũ', 'thế hệ',
  ],
  doctorcar: [
    'ô tô', 'xe hơi', 'bảo dưỡng', 'sửa xe', 'garage',
    'đăng kiểm', 'bảo hiểm xe', 'tai nạn', 'triệu hồi', 'lốp xe',
  ],
};

// ─── Product DB Collections ───

const PRODUCT_DB_COLLECTIONS: Record<string, { db: string; collection: string }> = {
  trendbriefai: { db: 'trendbriefai', collection: 'article_suggestions' },
  childhood: { db: 'childhood_video_engine', collection: 'trending_patterns' },
  smartbuy: { db: 'smartbuy', collection: 'trending_products' },
  caremate: { db: 'caremate_vn', collection: 'health_trends' },
  fintax: { db: 'fintax_ai', collection: 'finance_trends' },
  doctorcar: { db: 'doctor_car_ai', collection: 'auto_trends' },
};

export class TrendScanner {
  private mongoClient: MongoClient;
  private connected = false;

  constructor(config: TrendScannerConfig) {
    this.mongoClient = new MongoClient(config.mongoUri);
  }

  /**
   * Connect to MongoDB.
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.mongoClient.connect();
      this.connected = true;
    }
  }

  /**
   * Disconnect from MongoDB.
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.mongoClient.close();
      this.connected = false;
    }
  }

  /**
   * Fetch top 20 daily trends from Google Trends Vietnam.
   * Uses SerpAPI or direct scraping as fallback.
   */
  async fetchTrends(): Promise<Trend[]> {
    const today = new Date().toISOString().split('T')[0];

    // Try pytrends-style fetch via HTTP to a trends API
    // In production, this would use SerpAPI or a custom scraper
    // For now, return mock data structure
    try {
      // TODO:  Integrate with actual Google Trends API or SerpAPI
      // const response = await fetch('https://serpapi.com/search?engine=google_trends_trending_now&geo=VN');
      // const data = await response.json();

      // Placeholder:  Return empty array — products should implement their own trend fetching
      console.log('[TrendScanner] Google Trends integration pending — use product-specific trend sources');
      return [];
    } catch (err: any) {
      console.error('[TrendScanner] Error fetching trends:', err.message);
      return [];
    }
  }

  /**
   * Map trends to relevant products using keyword matching.
   */
  mapToProducts(trends: Trend[]): Map<string, Trend[]> {
    const productTrends = new Map<string, Trend[]>();

    for (const trend of trends) {
      const matchedProducts = this.matchTrendToProducts(trend);

      for (const product of matchedProducts) {
        if (!productTrends.has(product)) {
          productTrends.set(product, []);
        }
        productTrends.get(product)!.push(trend);
      }
    }

    return productTrends;
  }

  /**
   * Match a single trend to relevant products.
   */
  private matchTrendToProducts(trend: Trend): string[] {
    const titleLower = trend.title.toLowerCase();
    const matched: string[] = [];

    for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
      if (keywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
        matched.push(product);
      }
    }

    // Default to trendbriefai for unmatched trends (general news)
    if (matched.length === 0 && titleLower.length > 3) {
      matched.push('trendbriefai');
    }

    return matched;
  }

  /**
   * Insert trend suggestions into product databases.
   */
  async insertSuggestions(productTrends: Map<string, Trend[]>): Promise<number> {
    await this.connect();
    let totalInserted = 0;

    for (const [product, trends] of productTrends) {
      const dbConfig = PRODUCT_DB_COLLECTIONS[product];
      if (!dbConfig) continue;

      const db = this.mongoClient.db(dbConfig.db);
      const collection = db.collection(dbConfig.collection);

      for (const trend of trends) {
        const suggestion: TrendSuggestion = {
          trend_title: trend.title,
          trend_rank: trend.rank,
          trend_date: trend.date,
          trend_source: trend.source,
          product,
          status: 'pending',
          suggested_at: new Date(),
          acted_on: false,
        };

        try {
          // Upsert to avoid duplicates
          const result = await collection.updateOne(
            {
              trend_title: suggestion.trend_title,
              product,
              trend_date: suggestion.trend_date,
            },
            { $setOnInsert: suggestion },
            { upsert: true },
          );

          if (result.upsertedCount > 0) {
            totalInserted++;
          }
        } catch (err: any) {
          console.error(`[TrendScanner] Error inserting suggestion for ${product}:`, err.message);
        }
      }
    }

    return totalInserted;
  }

  /**
   * Run a full scan:  fetch trends, map to products, insert suggestions.
   */
  async scan(): Promise<{ trendsFound: number; suggestionsInserted: number }> {
    const trends = await this.fetchTrends();
    const productTrends = this.mapToProducts(trends);
    const suggestionsInserted = await this.insertSuggestions(productTrends);

    return {
      trendsFound: trends.length,
      suggestionsInserted,
    };
  }

  /**
   * Get weekly trend report data.
   */
  async getWeeklyReport(): Promise<Record<string, Trend[]>> {
    await this.connect();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const report: Record<string, Trend[]> = {};

    for (const [product, dbConfig] of Object.entries(PRODUCT_DB_COLLECTIONS)) {
      try {
        const db = this.mongoClient.db(dbConfig.db);
        const collection = db.collection(dbConfig.collection);

        const suggestions = await collection
          .find({ suggested_at: { $gte: oneWeekAgo } })
          .sort({ trend_rank: 1 })
          .limit(10)
          .toArray();

        report[product] = suggestions.map((s: any) => ({
          title: s.trend_title,
          rank: s.trend_rank,
          date: s.trend_date,
          source: s.trend_source,
        }));
      } catch (err: any) {
        console.error(`[TrendScanner] Error fetching weekly data for ${product}:`, err.message);
        report[product] = [];
      }
    }

    return report;
  }
}

export default TrendScanner;
