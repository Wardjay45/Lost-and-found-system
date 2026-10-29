import { aiFetch } from './services/aiClient.js';
import app from './app.js';
import supabase from './db.js';
import os from 'os';
const PORT = process.env.PORT || 3001;
const AI_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

// ── Auto-Embedding Background Poller ────────────────────────────
// Mobile app inserts directly into Supabase (bypasses Express routes),
// so this poller scans for items missing AI embeddings and generates them.
// Checks every 30 seconds, starts 10 seconds after server boots.

const generateEmbeddingsForItem = async (item, table, imageUrl) => {
  try {
    const updates = {};
    if (item.description) {
      try {
        const r = await aiFetch(`${AI_URL}/embedding/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.description }),
        });
        if (r.ok) {
          const { embedding } = await r.json();
          updates.text_embedding = embedding;
        }
      } catch {}
    }
    if (imageUrl) {
      try {
        let imageBase64 = imageUrl;
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const arrayBuffer = await imgResp.arrayBuffer();
            const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
            imageBase64 = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
          } else { imageBase64 = null; }
        }
        if (imageBase64 && !imageBase64.startsWith('data:')) {
          imageBase64 = `data:image/jpeg;base64,${imageBase64}`;
        }
        if (imageBase64) {
          const r = await aiFetch(`${AI_URL}/embedding/image-base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 }),
          });
          if (r.ok) {
            const { embedding } = await r.json();
            updates.image_embedding = embedding;
          }
        }
      } catch {}
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from(table).update(updates).eq('id', item.id);
      console.log(`  ✅ Auto-embedded ${table}#${item.id}: ${Object.keys(updates).join(', ')}`);
    }
  } catch (e) {
    console.log(`  ⚠ Auto-embed failed for ${table}#${item.id}: ${e.message}`);
  }
};

const pollForUnembedded = async () => {
  for (const table of ['lost_items', 'found_items']) {
    try {
      const { data: items } = await supabase
        .from(table)
        .select('id, description, image')
        .or('image_embedding.is.null,text_embedding.is.null')
        .limit(5);
      for (const item of (items || [])) {
        const img = item.image || item.image_url || null;
        await generateEmbeddingsForItem(item, table, img);
      }
      if (items?.length) console.log(`  🔄 Polled ${items.length} unembedded ${table}`);
    } catch (_) {
      // Silent — table may not exist yet
    }
  }
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!name.includes('Virtual') && !name.includes('VMware') && !name.includes('vEthernet')) {
          return iface.address;
        }
      }
    }
  }
  return '0.0.0.0';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('============================================');
  console.log('  Lost & Found Server — RUNNING');
  console.log('============================================');
  console.log(`  Local:   http://localhost:${PORT}/api`);
  console.log(`  Network: http://${localIP}:${PORT}/api`);
  console.log('');
  console.log('  🤖 Auto-embedding poller active (every 30s)');
  console.log('  ✅ Items inserted from mobile app will get');
  console.log('     AI embeddings automatically');
  console.log('============================================');

  // Start auto-embedding poller after 10 seconds
  setTimeout(() => {
    pollForUnembedded();
    setInterval(pollForUnembedded, 30000);
    console.log('  🔍 Auto-embedding poller started');
  }, 10000);
});
