// Diagnose Supabase database disk usage for the Lost & Found app.
// The main disk hog is base64 images stored directly in the `image` column
// (inserted by the mobile app, which bypasses the Express server).
//
// Usage: node server/diagnose-disk.mjs
import supabase from './db.js';

const MB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

async function diagnose(table) {
  const { count: total, error: totalErr } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  const { count: base64Count, error: countErr } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .like('image', 'data:image/%');

  const { data: base64Rows, error: rowsErr } = await supabase
    .from(table)
    .select('id, image')
    .like('image', 'data:image/%');

  if (totalErr || countErr || rowsErr) {
    console.error(`\n❌ ${table}:`, (totalErr || countErr || rowsErr).message);
    return;
  }

  let base64Bytes = 0;
  for (const row of (base64Rows || [])) {
    base64Bytes += (row.image || '').length;
  }

  console.log(`\n=== ${table} ===`);
  console.log(`  Total rows:            ${total}`);
  console.log(`  Base64 images in DB:   ${base64Count}`);
  console.log(`  Base64 size (TEXT):    ${MB(base64Bytes)}`);
}

async function main() {
  console.log('🔍 Diagnosing Supabase disk usage...\n');
  await diagnose('lost_items');
  await diagnose('found_items');
  console.log('\nℹ️  For an exact per-table size, run server/reclaim-disk.sql in the SQL Editor.');
}

main();
