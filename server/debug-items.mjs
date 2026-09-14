// Debug: Check item embeddings and image format
import supabase from './db.js';

async function main() {
  const tables = ['lost_items', 'found_items'];
  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const { data: items, error } = await supabase.from(table).select('*').limit(10);
    if (error) { console.error(error); continue; }
    if (!items || items.length === 0) { console.log('  (empty)'); continue; }
    items.forEach(item => {
      const hasTextEmb = item.text_embedding ? `YES (${item.text_embedding.length} dims)` : 'NO';
      const hasImgEmb = item.image_embedding ? `YES (${item.image_embedding.length} dims)` : 'NO';
      const imgType = item.image
        ? (item.image.startsWith('data:image') ? 'base64' : item.image.startsWith('http') ? 'URL' : 'other')
        : 'none';
      console.log(`  ID:${item.id} | "${(item.description || '').substring(0, 40)}" | textEmb:${hasTextEmb} | imgEmb:${hasImgEmb} | imgType:${imgType}`);
    });
  }
}

main();