import { aiFetch } from './aiClient.js';

export async function prepareCandidateEmbeddings(client, items, { fetcher = aiFetch, maxItems = 20 } = {}) {
  const missing = items.filter(item => (item.description && !item.text_embedding?.length) || (item.image && !item.image_embedding?.length));
  let completed = 0;
  for (const item of missing.slice(0, maxItems)) {
    const updates = {};
    if (item.description && !item.text_embedding?.length) {
      const response = await fetcher((process.env.AI_SERVER_URL || 'http://localhost:8000') + '/embedding/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: item.description }) });
      if (!response.ok) throw new Error('AI text preparation failed. Please retry matching.');
      updates.text_embedding = (await response.json()).embedding;
      if (!Array.isArray(updates.text_embedding) || !updates.text_embedding.length) throw new Error('AI returned an invalid text embedding.');
    }
    if (item.image && !item.image_embedding?.length) {
      let image = item.image;
      if (!image.startsWith('data:')) {
        const source = new URL(image), storage = new URL(process.env.SUPABASE_URL);
        if (source.protocol !== 'https:' || source.origin !== storage.origin) throw new Error('Report photo must be stored in the configured school storage.');
        const photo = await fetch(image);
        if (!photo.ok) throw new Error('Unable to read a report photo.');
        const bytes = await photo.arrayBuffer();
        if (bytes.byteLength > 3000000) throw new Error('Report photo is too large for hosted matching.');
        image = 'data:' + (photo.headers.get('content-type') || 'image/jpeg') + ';base64,' + Buffer.from(bytes).toString('base64');
      }
      const response = await fetcher((process.env.AI_SERVER_URL || 'http://localhost:8000') + '/embedding/image-base64', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) });
      if (!response.ok) throw new Error('AI image preparation failed. Please retry matching.');
      updates.image_embedding = (await response.json()).embedding;
      if (!Array.isArray(updates.image_embedding) || !updates.image_embedding.length) throw new Error('AI returned an invalid image embedding.');
    }
    const { error } = await client.from('found_items').update(updates).eq('id', item.id);
    if (error) throw error;
    Object.assign(item, updates); completed++;
  }
  if (missing.length > completed) throw new Error(completed + ' report photos/descriptions were prepared. Run matching again to finish preparing the remaining reports.');
}
