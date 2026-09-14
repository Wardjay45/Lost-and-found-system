// Comprehensive Supabase usage check — counts every public table and lists
// Storage bucket contents so we can find what is actually consuming disk.
//
// Usage: node server/diagnose-full.mjs
import supabase from './db.js';

const TABLES = [
  'categories',
  'users',
  'lost_items',
  'found_items',
  'matches',
  'messages',
  'conversations',
  'activity_logs',
  'qr_locations',
];

async function countRows(table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) return `${table}: (error) ${error.message}`;
  return `${table}: ${count} rows`;
}

async function main() {
  console.log('📊 Table row counts:\n');
  for (const t of TABLES) {
    console.log('  ' + (await countRows(t)));
  }

  console.log('\n🗂️  Storage buckets:\n');
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    console.log('  (error listing buckets)', bucketErr.message);
  } else if (!buckets || buckets.length === 0) {
    console.log('  (no buckets)');
  } else {
    for (const b of buckets) {
      const { data: files, error: listErr } = await supabase.storage.from(b.name).list();
      if (listErr) {
        console.log(`  ${b.name}: (error) ${listErr.message}`);
        continue;
      }
      const filesArr = files || [];
      const totalBytes = filesArr.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);
      console.log(`  ${b.name}: ${filesArr.length} file(s), ~${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    }
  }

  console.log('\nℹ️  For the exact database size, run the SQL in server/reclaim-disk.sql (SQL Editor).');
}

main();
