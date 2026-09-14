/**
 * One-time script to normalize all existing lost & found item locations.
 * Run: node normalize-existing-locations.mjs
 * This will update all existing records to use canonical location names.
 * QR locations are NOT affected.
 */
import supabase from './db.js';
import { normalizeLocation } from './location-normalizer.js';
import fs from 'fs';

async function main() {
  console.log('🔧 Location Normalizer - Retroactive Cleanup');
  console.log('============================================\n');

  // Fetch QR locations for exact matching
  const { data: qrLocations } = await supabase.from('qr_locations').select('name');
  console.log(`📍 Loaded ${qrLocations?.length || 0} QR locations for reference\n`);

  const log = [];

  // === Lost Items ===
  console.log('🔄 Processing lost items...');
  const { data: lostItems } = await supabase.from('lost_items').select('id, location_lost, item_id');
  let lostUpdated = 0;

  if (lostItems) {
    for (const item of lostItems) {
      if (!item.location_lost) continue;
      const normalized = normalizeLocation(item.location_lost, qrLocations || []);
      if (normalized !== item.location_lost) {
        await supabase.from('lost_items')
          .update({ location_lost: normalized })
          .eq('id', item.id);
        lostUpdated++;
        log.push(`  [LOST #${item.item_id}] "${item.location_lost}" → "${normalized}"`);
        console.log(`  ✅ ${item.item_id}: "${item.location_lost}" → "${normalized}"`);
      }
    }
  }
  console.log(`📊 Lost items: ${lostUpdated} updated out of ${lostItems?.length || 0} total\n`);

  // === Found Items ===
  console.log('🔄 Processing found items...');
  const { data: foundItems } = await supabase.from('found_items').select('id, location_found, item_id');
  let foundUpdated = 0;

  if (foundItems) {
    for (const item of foundItems) {
      if (!item.location_found) continue;
      const normalized = normalizeLocation(item.location_found, qrLocations || []);
      if (normalized !== item.location_found) {
        await supabase.from('found_items')
          .update({ location_found: normalized })
          .eq('id', item.id);
        foundUpdated++;
        log.push(`  [FOUND #${item.item_id}] "${item.location_found}" → "${normalized}"`);
        console.log(`  ✅ ${item.item_id}: "${item.location_found}" → "${normalized}"`);
      }
    }
  }
  console.log(`📊 Found items: ${foundUpdated} updated out of ${foundItems?.length || 0} total\n`);

  // === Summary ===
  console.log('============================================');
  console.log(`✅ Complete! ${lostUpdated + foundUpdated} locations normalized.`);
  console.log(`   Lost:  ${lostUpdated} updated`);
  console.log(`   Found: ${foundUpdated} updated`);

  // Save log
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(`normalize-log-${timestamp}.txt`, log.join('\n'));
  console.log(`\n📄 Detailed log saved to normalize-log-${timestamp}.txt`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});