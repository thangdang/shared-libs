/**
 * Seed Affiliate Accounts for all 6 WinLux Apps
 * 
 * Run this script in each app's MongoDB database:
 * - smartbuy_db
 * - video_engine_db
 * - doctorcar_db
 * - caremate_db
 * - fintax_db
 * - trendbrief_db
 */

// Affiliate accounts - same structure, different source_app per database
const affiliateAccounts = [
  {
    platform: 'shopee',
    account_id: 'shopee_affiliate_001',
    tracking_id: 'WINLUX_SHP',
    api_key: '',  // Fill with actual key
    api_secret: '',  // Fill with actual secret
    is_active: true,
    commission_rates: {
      electronics: 0.02,
      fashion: 0.04,
      beauty: 0.05,
      home: 0.03,
      default: 0.03
    },
    postback_url: '/affiliate/postback/shopee',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    platform: 'lazada',
    account_id: 'lazada_affiliate_001',
    tracking_id: 'WINLUX_LZD',
    api_key: '',
    api_secret: '',
    is_active: true,
    commission_rates: {
      electronics: 0.025,
      fashion: 0.045,
      beauty: 0.055,
      home: 0.035,
      default: 0.035
    },
    postback_url: '/affiliate/postback/lazada',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    platform: 'tiki',
    account_id: 'tiki_affiliate_001',
    tracking_id: 'WINLUX_TIKI',
    api_key: '',
    api_secret: '',
    is_active: true,
    commission_rates: {
      electronics: 0.015,
      fashion: 0.03,
      beauty: 0.04,
      books: 0.05,
      default: 0.025
    },
    postback_url: '/affiliate/postback/tiki',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    platform: 'tiktok',
    account_id: 'tiktok_shop_001',
    tracking_id: 'WINLUX_TTK',
    api_key: '',
    api_secret: '',
    is_active: true,
    commission_rates: {
      electronics: 0.03,
      fashion: 0.05,
      beauty: 0.06,
      default: 0.04
    },
    postback_url: '/affiliate/postback/tiktok',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    platform: 'sendo',
    account_id: 'sendo_affiliate_001',
    tracking_id: 'WINLUX_SENDO',
    api_key: '',
    api_secret: '',
    is_active: true,
    commission_rates: {
      electronics: 0.02,
      fashion: 0.035,
      beauty: 0.04,
      default: 0.025
    },
    postback_url: '/affiliate/postback/sendo',
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Get current database name to set source_app
const dbName = db.getName();
const sourceAppMap = {
  'smartbuy_db': 'smartbuy',
  'video_engine_db': 'videoengine',
  'doctorcar_db': 'doctorcar',
  'caremate_db': 'caremate',
  'fintax_db': 'fintax',
  'trendbrief_db': 'trendbrief'
};

const sourceApp = sourceAppMap[dbName] || dbName.replace('_db', '');

print(`\n=== Seeding Affiliate Accounts for ${sourceApp} ===\n`);

// Add source_app to each account
const accountsWithSource = affiliateAccounts.map(acc => ({
  ...acc,
  source_app: sourceApp
}));

// Create collection if not exists
if (!db.getCollectionNames().includes('affiliate_accounts')) {
  db.createCollection('affiliate_accounts');
  print('Created affiliate_accounts collection');
}

// Create indexes
db.affiliate_accounts.createIndex({ platform: 1, source_app: 1 }, { unique: true });
db.affiliate_accounts.createIndex({ is_active: 1 });
print('Created indexes on affiliate_accounts');

// Upsert accounts
accountsWithSource.forEach(account => {
  const result = db.affiliate_accounts.updateOne(
    { platform: account.platform, source_app: account.source_app },
    { $set: account },
    { upsert: true }
  );
  
  if (result.upsertedCount > 0) {
    print(`  ✅ Created ${account.platform} account`);
  } else if (result.modifiedCount > 0) {
    print(`  🔄 Updated ${account.platform} account`);
  } else {
    print(`  ⏭️  ${account.platform} account unchanged`);
  }
});

// Create affiliate_links collection
if (!db.getCollectionNames().includes('affiliate_links')) {
  db.createCollection('affiliate_links');
  print('\nCreated affiliate_links collection');
}

db.affiliate_links.createIndex({ id: 1 }, { unique: true });
db.affiliate_links.createIndex({ platform: 1 });
db.affiliate_links.createIndex({ source_app: 1 });
db.affiliate_links.createIndex({ created_at: -1 });
db.affiliate_links.createIndex({ category: 1 });
print('Created indexes on affiliate_links');

// Create affiliate_clicks collection
if (!db.getCollectionNames().includes('affiliate_clicks')) {
  db.createCollection('affiliate_clicks');
  print('\nCreated affiliate_clicks collection');
}

db.affiliate_clicks.createIndex({ id: 1 }, { unique: true });
db.affiliate_clicks.createIndex({ link_id: 1 });
db.affiliate_clicks.createIndex({ clicked_at: -1 });
db.affiliate_clicks.createIndex({ converted: 1, clicked_at: -1 });
db.affiliate_clicks.createIndex({ ip_address: 1, clicked_at: -1 });
print('Created indexes on affiliate_clicks');

print(`\n✅ Affiliate setup complete for ${sourceApp}!`);
print(`   - ${accountsWithSource.length} platform accounts configured`);
print(`   - Collections: affiliate_accounts, affiliate_links, affiliate_clicks`);
print('\n⚠️  Remember to fill in API keys and secrets for each platform!\n');
