/**
 * MongoDB Index Setup for Offline Resilience
 *
 * Creates required indexes for cache and queue collections.
 * Run once per VPS service during initial setup.
 *
 * Usage: npx ts-node src/setup/createIndexes.ts
 */

import { Db, MongoClient } from 'mongodb';

const SERVICES = [
  'trendbriefai',
  'smartbuyai',
  'caremateai',
  'fintaxai',
  'videoai',
];

async function createIndexesForService(db: Db, serviceName: string): Promise<void> {
  const cacheCollectionName = `${serviceName}_ai_cache`;
  const queueCollectionName = `${serviceName}_ai_queue`;

  console.log(`Setting up indexes for service: ${serviceName}`);

  // Cache collection indexes
  const cacheCollection = db.collection(cacheCollectionName);

  // Text index on 'query' field for similarity search
  await cacheCollection.createIndex(
    { query: 'text' },
    { name: 'query_text_idx' }
  );

  // TTL index on 'expires_at' for automatic cache cleanup
  await cacheCollection.createIndex(
    { expires_at: 1 },
    { expireAfterSeconds: 0, name: 'expires_at_ttl_idx' }
  );

  // Index on created_at for sorting
  await cacheCollection.createIndex(
    { created_at: -1 },
    { name: 'created_at_idx' }
  );

  console.log(`  ✓ ${cacheCollectionName}: text index, TTL index, created_at index`);

  // Queue collection indexes
  const queueCollection = db.collection(queueCollectionName);

  // Compound index on status + created_at for FIFO processing
  await queueCollection.createIndex(
    { status: 1, created_at: 1 },
    { name: 'status_created_at_idx' }
  );

  // Index on status for filtering
  await queueCollection.createIndex(
    { status: 1 },
    { name: 'status_idx' }
  );

  console.log(`  ✓ ${queueCollectionName}: status+created_at index, status index`);
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

  console.log('=== Offline Resilience MongoDB Index Setup ===\n');
  console.log(`Connecting to: ${mongoUri}\n`);

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();

    for (const service of SERVICES) {
      const dbName = `${service}_db`;
      const db = client.db(dbName);
      await createIndexesForService(db, service);
      console.log('');
    }

    console.log('=== All indexes created successfully ===');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
