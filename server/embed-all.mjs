// Run this to generate AI embeddings for all lost & found items
// Usage: node server/embed-all.mjs

const API = 'http://localhost:3001/api';

async function embed(table) {
  console.log(`\n📊 Generating embeddings for: ${table}...`);
  const res = await fetch(`${API}/ai/batch-embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table }),
  });
  const data = await res.json();
  console.log(`   ✅ ${table}: ${data.processed}/${data.total} items embedded`);
}

async function main() {
  console.log('🧠 Starting batch embedding...\n');
  await embed('lost_items');
  await embed('found_items');
  console.log('\n🎉 Done! All items now have AI embeddings.');
  console.log('   You can now use Smart Matching in the admin dashboard or mobile app.');
}

main().catch(err => console.error('Error:', err.message));