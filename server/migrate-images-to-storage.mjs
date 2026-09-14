// Migrate base64 images stored in the database into Supabase Storage.
//
// The mobile app currently inserts photos as base64 text directly into the
// `image` column, which eats up the small free-plan *database* disk quota.
// This script uploads each base64 image to a Storage bucket and replaces the
// row value with a short public URL, reclaiming DB space while keeping photos.
//
// Usage: node server/migrate-images-to-storage.mjs
//
// NOTE: This WRITES to your database and Storage. Back up first if needed.
import supabase from './db.js';

// The Express server currently uploads both lost and found images to this
// bucket (see server/routes/lostItems.js and server/routes/foundItems.js).
// Change it if you use a different bucket.
const BUCKET = 'lost-items';

const TABLES = [
  { table: 'lost_items', prefix: 'lost' },
  { table: 'found_items', prefix: 'found' },
];

async function migrate({ table, prefix }) {
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, image')
    .like('image', 'data:image/%');

  if (error) {
    console.error(`❌ ${table}: ${error.message}`);
    return;
  }
  if (!rows || rows.length === 0) {
    console.log(`✓ ${table}: no base64 images to migrate`);
    return;
  }

  console.log(`\n📦 ${table}: ${rows.length} base64 image(s) found`);
  let migrated = 0;
  let failed = 0;

  for (const row of rows) {
    const match = row.image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      failed += 1;
      continue;
    }
    const [, mimeType, b64] = match;
    const buffer = Buffer.from(b64, 'base64');
    const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpeg';
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    try {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, buffer, { contentType: mimeType, upsert: false });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);
      const { error: updateErr } = await supabase
        .from(table)
        .update({ image: publicUrl })
        .eq('id', row.id);
      if (updateErr) throw updateErr;

      migrated += 1;
      console.log(`  ✓ ${table}#${row.id} → ${publicUrl}`);
    } catch (e) {
      failed += 1;
      console.error(`  ✗ ${table}#${row.id}: ${e.message}`);
    }
  }

  console.log(`✅ ${table}: ${migrated} migrated, ${failed} failed`);
}

async function main() {
  console.log('🚀 Migrating base64 images to Supabase Storage...');
  for (const t of TABLES) {
    await migrate(t);
  }
  console.log('\nDone. Now run server/reclaim-disk.sql to NULL out any leftovers and VACUUM.');
}

main();
