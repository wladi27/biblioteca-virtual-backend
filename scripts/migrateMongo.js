#!/usr/bin/env node
/*
  migrateMongo.js

  Usage:
    NODE_ENV=production node migrateMongo.js --source "<sourceUri>" --dest "<destUri>" [--drop] [--exclude=db1,db2]

  Description:
    Migrates all non-system databases and collections (including indexes and documents)
    from a source MongoDB URI to a destination MongoDB URI. By default it uses
    environment variables SOURCE_MONGO_URI and DEST_MONGO_URI (from .env if present).

  Notes:
    - Skips admin, local and config databases.
    - Pass --drop to drop each destination database before migrating its collections.
    - Use --exclude to skip comma-separated database names.
    - Requires `npm install mongodb dotenv` to run.
*/

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load .env if present
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
  // ignore
}

const argv = require('minimist')(process.argv.slice(2));

const SOURCE = argv.source || process.env.SOURCE_MONGO_URI || process.env.DB_URI || process.env.DEST_MONGO_URI || process.env.MONGODB_URI;
const DEST = argv.dest || process.env.DEST_MONGO_URI || process.env.DESTINATION_MONGO_URI || process.env.TO_MONGO_URI;
const DROP = argv.drop || false;
const EXCLUDE = (argv.exclude || '').split(',').map(s => s.trim()).filter(Boolean);
const BATCH_SIZE = parseInt(argv.batch || '1000', 10) || 1000;

if (!SOURCE || !DEST) {
  console.error('\nERROR: Missing required source or dest MongoDB URI.');
  console.error('Provide via --source and --dest or set SOURCE_MONGO_URI and DEST_MONGO_URI in environment or .env');
  process.exit(1);
}

console.log('Source:', SOURCE);
console.log('Dest:  ', DEST);
console.log('Drop dest DBs before copy:', DROP);
if (EXCLUDE.length) console.log('Excluding DBs:', EXCLUDE.join(', '));
console.log('Batch size:', BATCH_SIZE);

async function copyCollection(srcDb, destDb, collInfo) {
  const collName = collInfo.name;
  if (collName.startsWith('system.')) {
    console.log(`  - Skipping system collection ${collName}`);
    return;
  }

  console.log(`  - Copying collection: ${collName}`);
  const srcColl = srcDb.collection(collName);
  const destColl = destDb.collection(collName);

  // Recreate indexes (except default _id_)
  try {
    const indexes = await srcColl.indexes();
    for (const idx of indexes) {
      if (idx.name === '_id_') continue;
      const indexSpec = idx.key;
      const indexOptions = Object.assign({}, idx);
      // remove fields not allowed in createIndex options
      delete indexOptions.key;
      delete indexOptions.v;
      delete indexOptions.ns;
      // try to create index
      try {
        await destColl.createIndex(indexSpec, indexOptions);
        console.log(`    · Created index ${idx.name}`);
      } catch (e) {
        console.warn(`    · Warning: could not create index ${idx.name}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn('    · Warning: failed to copy indexes:', e.message);
  }

  // Copy documents in batches
  const cursor = srcColl.find({});
  let batch = [];
  let total = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      try {
        await destColl.insertMany(batch, { ordered: false });
        total += batch.length;
      } catch (e) {
        // ignore duplicate key errors etc
        if (e.code && e.code === 11000) {
          console.warn('    · Duplicate keys on insertMany (some docs skipped)');
        } else {
          console.warn('    · insertMany warning:', e.message);
        }
      }
      batch = [];
    }
  }
  if (batch.length) {
    try {
      await destColl.insertMany(batch, { ordered: false });
      total += batch.length;
    } catch (e) {
      if (e.code && e.code === 11000) {
        console.warn('    · Duplicate keys on insertMany (some docs skipped)');
      } else {
        console.warn('    · insertMany warning:', e.message);
      }
    }
  }

  console.log(`    · Finished collection ${collName}. Approx docs copied: ${total}`);
}

async function migrate() {
  const srcClient = new MongoClient(SOURCE, { useNewUrlParser: true, useUnifiedTopology: true });
  const destClient = new MongoClient(DEST, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await srcClient.connect();
    await destClient.connect();

    const admin = srcClient.db().admin();
    const dbs = await admin.listDatabases();

    for (const dbInfo of dbs.databases) {
      const dbName = dbInfo.name;
      if (['admin', 'local', 'config'].includes(dbName)) continue;
      if (EXCLUDE.includes(dbName)) continue;

      console.log(`\n== Migrating database: ${dbName} ==`);
      const srcDb = srcClient.db(dbName);
      const destDb = destClient.db(dbName);

      if (DROP) {
        try {
          await destDb.dropDatabase();
          console.log('  · Dropped destination database', dbName);
        } catch (e) {
          console.warn('  · Could not drop database:', e.message);
        }
      }

      const collections = await srcDb.listCollections().toArray();
      for (const collInfo of collections) {
        try {
          await copyCollection(srcDb, destDb, collInfo);
        } catch (e) {
          console.error(`  ! Error copying collection ${collInfo.name}:`, e.message);
        }
      }

      console.log(`== Finished database: ${dbName} ==\n`);
    }

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 2;
  } finally {
    try { await srcClient.close(); } catch (e) {}
    try { await destClient.close(); } catch (e) {}
  }
}

migrate();
