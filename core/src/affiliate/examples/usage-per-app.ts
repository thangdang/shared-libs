/**
 * Example Usage - Affiliate Module in Each App
 * 
 * Each app has its own database, but uses the same shared affiliate code.
 */

import { MongoClient } from 'mongodb';
import { 
  AffiliateService, 
  MongoAffiliateRepository,
  AppName 
} from '../index';

// ============================================================================
// APP 1: SmartBuy - Price Comparison
// Database: smartbuy_db
// ============================================================================

async function setupSmartBuyAffiliate() {
  const client = new MongoClient(process.env.SMARTBUY_MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('smartbuy_db');
  const repository = new MongoAffiliateRepository(db);
  await repository.initializeIndexes();
  
  const affiliateService = new AffiliateService(repository, 'smartbuy');
  
  // Example: User searches for "iPhone 15"
  const match = await affiliateService.matchAndGenerateLink({
    content: 'iPhone 15 Pro Max 256GB',
    productName: 'iPhone 15 Pro Max 256GB',
    productUrl: 'https://shopee.vn/iPhone-15-Pro-Max-i.123.456789',
    price: 28990000, // VND
    sourceApp: 'smartbuy'
  });
  
  console.log('SmartBuy Match:', match);
  // Output: { platform: 'shopee', category: 'electronics', commissionRate: 0.03, ... }
  
  return affiliateService;
}

// ============================================================================
// APP 2: Video Engine - YouTube/TikTok Description Links
// Database: video_engine_db
// ============================================================================

async function setupVideoEngineAffiliate() {
  const client = new MongoClient(process.env.VIDEO_ENGINE_MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('video_engine_db');
  const repository = new MongoAffiliateRepository(db);
  await repository.initializeIndexes();
  
  const affiliateService = new AffiliateService(repository, 'video_engine');
  
  // Example: Video about "Top 5 điện thoại 2026" - generate affiliate links for description
  const products = [
    { name: 'iPhone 15 Pro Max', url: 'https://shopee.vn/iphone15', price: 28990000 },
    { name: 'Samsung S24 Ultra', url: 'https://shopee.vn/s24ultra', price: 27990000 },
    { name: 'Xiaomi 14 Pro', url: 'https://lazada.vn/xiaomi14', price: 18990000 },
  ];
  
  const descriptionLinks: string[] = [];
  
  for (const product of products) {
    const match = await affiliateService.matchAndGenerateLink({
      content: product.name,
      productName: product.name,
      productUrl: product.url,
      price: product.price,
      sourceApp: 'video_engine'
    });
    
    if (match) {
      descriptionLinks.push(`▶ ${product.name}: ${match.affiliateUrl}`);
    }
  }
  
  const videoDescription = `
🛒 Link sản phẩm trong video:
${descriptionLinks.join('\n')}

⚠️ Đây là affiliate link, mình nhận hoa hồng nhỏ nếu bạn mua qua link này.
`;
  
  console.log('Video Description:', videoDescription);
  
  return affiliateService;
}

// ============================================================================
// APP 3: DoctorCar - Auto Parts & Insurance
// Database: doctorcar_db
// ============================================================================

async function setupDoctorCarAffiliate() {
  const client = new MongoClient(process.env.DOCTORCAR_MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('doctorcar_db');
  const repository = new MongoAffiliateRepository(db);
  await repository.initializeIndexes();
  
  const affiliateService = new AffiliateService(repository, 'doctorcar');
  
  // Example: User diagnoses "xe kêu két két khi phanh" → Suggest brake pads
  const match = await affiliateService.matchAndGenerateLink({
    content: 'má phanh Brembo',
    productName: 'Má phanh Brembo cho Toyota Vios',
    productUrl: 'https://shopee.vn/ma-phanh-brembo-i.789.123',
    price: 850000, // VND
    sourceApp: 'doctorcar'
  });
  
  console.log('DoctorCar Match:', match);
  // Output: { platform: 'shopee', category: 'auto_parts', commissionRate: 0.05, ... }
  
  return affiliateService;
}

// ============================================================================
// APP 4: CareMate - Pharmacy Affiliate (Long Châu, Pharmacity)
// Database: caremate_db
// ============================================================================

async function setupCareMateAffiliate() {
  const client = new MongoClient(process.env.CAREMATE_MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('caremate_db');
  const repository = new MongoAffiliateRepository(db);
  await repository.initializeIndexes();
  
  const affiliateService = new AffiliateService(repository, 'caremate');
  
  // Example: User searches for "thuốc đau đầu" → Suggest Panadol from Long Châu
  const match = await affiliateService.matchAndGenerateLink({
    content: 'thuốc Panadol đau đầu',
    productName: 'Panadol Extra 500mg',
    productUrl: 'https://nhathuoclongchau.com.vn/panadol-extra',
    price: 35000, // VND
    sourceApp: 'caremate'
  });
  
  console.log('CareMate Match:', match);
  // Output: { platform: 'longchau', category: 'medicine', commissionRate: 0.04, ... }
  
  return affiliateService;
}

// ============================================================================
// APP 5: FinTax - Books & Software
// Database: fintax_db
// ============================================================================

async function setupFinTaxAffiliate() {
  const client = new MongoClient(process.env.FINTAX_MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('fintax_db');
  const repository = new MongoAffiliateRepository(db);
  await repository.initializeIndexes();
  
  const affiliateService = new AffiliateService(repository, 'fintax');
  
  // Example: Recommend tax/accounting books after user completes tax calculation
  const match = await affiliateService.matchAndGenerateLink({
    content: 'sách kế toán thuế',
    productName: 'Sách Hướng Dẫn Quyết Toán Thuế TNCN 2026',
    productUrl: 'https://tiki.vn/sach-thue-tncn-p123456',
    price: 189000, // VND
    sourceApp: 'fintax'
  });
  
  console.log('FinTax Match:', match);
  // Output: { platform: 'tiki', category: 'books', commissionRate: 0.05, ... }
  
  return affiliateService;
}

// ============================================================================
// APP 6: TrendBrief - Context-based News Links
// Database: trendbrief_db
// ============================================================================

async function setupTrendBriefAffiliate() {
  const client = new MongoClient(process.env.TRENDBRIEF_MONGODB_URI || 'mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('trendbrief_db');
  const repository = new MongoAffiliateRepository(db);
  await repository.initializeIndexes();
  
  const affiliateService = new AffiliateService(repository, 'trendbrief');
  
  // Example: News article about "iPhone 16 ra mắt" → Insert link to buy iPhone 15
  const newsContent = 'Apple công bố iPhone 16 với nhiều tính năng AI mới...';
  
  // Detect product mentions and add affiliate links
  const match = await affiliateService.matchAndGenerateLink({
    content: newsContent + ' iPhone',
    productName: 'iPhone 15 Pro Max (giá tốt hơn iPhone 16)',
    productUrl: 'https://shopee.vn/iphone-15-pro-max-i.123.456',
    price: 25990000, // VND (discounted)
    sourceApp: 'trendbrief'
  });
  
  console.log('TrendBrief Match:', match);
  
  return affiliateService;
}

// ============================================================================
// Database Connection Strings (Example)
// ============================================================================

/*
Each app has its own database:

SMARTBUY_MONGODB_URI=mongodb://localhost:27017/smartbuy_db
VIDEO_ENGINE_MONGODB_URI=mongodb://localhost:27017/video_engine_db
DOCTORCAR_MONGODB_URI=mongodb://localhost:27017/doctorcar_db
CAREMATE_MONGODB_URI=mongodb://localhost:27017/caremate_db
FINTAX_MONGODB_URI=mongodb://localhost:27017/fintax_db
TRENDBRIEF_MONGODB_URI=mongodb://localhost:27017/trendbrief_db

Or on same MongoDB instance with different databases:
MONGODB_URI=mongodb://localhost:27017

Then in each app:
- SmartBuy: db('smartbuy_db')
- Video Engine: db('video_engine_db')
- DoctorCar: db('doctorcar_db')
- CareMate: db('caremate_db')
- FinTax: db('fintax_db')
- TrendBrief: db('trendbrief_db')
*/

export {
  setupSmartBuyAffiliate,
  setupVideoEngineAffiliate,
  setupDoctorCarAffiliate,
  setupCareMateAffiliate,
  setupFinTaxAffiliate,
  setupTrendBriefAffiliate
};
