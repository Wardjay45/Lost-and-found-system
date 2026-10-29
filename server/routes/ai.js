import { prepareCandidateEmbeddings } from '../services/candidateEmbeddings.js';
import { aiFetch } from '../services/aiClient.js';
import { Router } from 'express';
import supabase from '../db.js';

const router = Router();

const AI_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

// Convert a public image URL to a base64 data URI
const fetchImageAsBase64 = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.log('Failed to fetch image for embedding:', e.message);
    return null;
  }
};

/**
 * Core matching endpoint - POST /api/ai/match
 * Accepts: { item_type: 'lost'|'found', description?: string, image_base64?: string }
 * Returns ranked matches of the opposite type
 */
router.post('/match', async (req, res) => {
  try {
    const { item_type, description, image_base64 } = req.body;

    if (!item_type) {
      return res.status(400).json({ error: 'item_type (lost or found) is required' });
    }
    if (!description && !image_base64) {
      return res.status(400).json({ error: 'Provide description or image_base64' });
    }

    const searchTable = item_type === 'lost' ? 'found_items' : 'lost_items';

    const { data: storedItems, error: fetchError } = await supabase
      .from(searchTable)
      .select('*')
      .in('status', ['active', 'pending'])
      .limit(500);

    if (fetchError) throw fetchError;

    if (!storedItems || storedItems.length === 0) {
      return res.json({ matches: [], message: 'No items found in the database yet.', total_searched: 0 });
    }

    const aiItems = storedItems.map(item => ({
      id: item.id,
      image_embedding: item.image_embedding,
      text_embedding: item.text_embedding,
    }));

    const reqBody = {
      text: description || '',
      image_base64: image_base64 || '',
      stored_items: aiItems,
      top_k: 10,
      image_weight: 0.7,
      text_weight: 0.3,
    };

    const aiResponse = await aiFetch(`${AI_URL}/combined-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI server error: ${errText}`);
    }

    const aiResult = await aiResponse.json();
    const scoredMatches = aiResult.matches || [];

    const enriched = scoredMatches.map(m => {
      const match = storedItems.find(i => i.id === m.id);
      return {
        id: m.id,
        score: m.score,
        image_score: m.image_score ?? 0,
        text_score: m.text_score ?? 0,
        item_id: match?.item_id,
        description: match?.description,
        category_name: match?.category_name,
        location: match?.location_lost || match?.location_found,
        location_details: match?.location_details,
        condition: match?.condition,
        image: match?.image_url || match?.image,
        status: match?.status,
        reporter_name: match?.reporter_name || match?.finder_name,
        date_reported: match?.date_reported || match?.date_found,
      };
    });

    res.json({ matches: enriched, total_searched: storedItems.length });
  } catch (err) {
    console.error('AI match error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/auto-match — Cross-match ALL lost items against ALL found items
 * This is the admin Smart Matching view — no manual input needed
 */
router.post('/auto-match', async (req, res) => {
  try {
    // Matching rules:
    // - Lost items: only 'active' (pending = not yet approved, potential_match/matched/claimed = already matched)
    // - Found items: only 'active' (potential_match/matched/claimed = already matched)
    const [{ data: lostItems, error: lostErr }, { data: foundItems, error: foundErr }] = await Promise.all([
      supabase.from('lost_items').select('*').eq('status', 'active').limit(500),
      supabase.from('found_items').select('*').eq('status', 'active').limit(500),
    ]);

    if (lostErr) throw lostErr;
    if (foundErr) throw foundErr;

    if (!lostItems?.length || !foundItems?.length) {
      return res.json({
        matches: [],
        lost_count: lostItems?.length || 0,
        found_count: foundItems?.length || 0,
        message: 'Need both lost and found items to match.',
      });
    }

    await prepareCandidateEmbeddings(supabase, foundItems);

    // Prepare found items embeddings for AI server
    const foundAiItems = foundItems.map(item => ({
      id: item.id,
      image_embedding: item.image_embedding,
      text_embedding: item.text_embedding,
    }));

    const allMatches = [];
    let successfulComparisons = 0;

    // For each lost item, match against all found items
    for (const lost of lostItems) {
      try {
        // Get image as base64 for AI matching (handles both base64 and URL images)
        let imageForAi = '';
        if (lost.image) {
          if (lost.image.startsWith('data:image')) {
            imageForAi = lost.image;
          } else if (lost.image.startsWith('http')) {
            imageForAi = (await fetchImageAsBase64(lost.image)) || '';
          }
        }
        const reqBody = {
          text: lost.description || '',
          image_base64: imageForAi,
          stored_items: foundAiItems,
          top_k: 5,
          image_weight: 0.7,
          text_weight: 0.3,
        };

        const aiResponse = await aiFetch(`${AI_URL}/combined-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        });

        if (!aiResponse.ok) continue;
        successfulComparisons++;
        const aiResult = await aiResponse.json();

        for (const m of (aiResult.matches || [])) {
          const found = foundItems.find(i => i.id === m.id);
          if (!found) continue;

          allMatches.push({
            id: `match-${lost.id}-${found.id}`,
            score: m.score,
            image_score: m.image_score ?? 0,
            text_score: m.text_score ?? 0,
            lost_item: {
              id: lost.id,
              item_id: lost.item_id,
              description: lost.description,
              category_name: lost.category_name,
              location: lost.location_lost,
              location_details: lost.location_details,
              last_updated: lost.last_updated,
              image: lost.image,
              status: lost.status,
              reporter_name: lost.reporter_name,
              date_reported: lost.date_reported,
            },
            found_item: {
              id: found.id,
              item_id: found.item_id,
              description: found.description,
              category_name: found.category_name,
              location: found.location_lost || found.location_found,
              location_details: found.location_details,
              last_updated: found.last_updated,
              condition: found.condition,
              finder_name: found.finder_name,
              date_found: found.date_found,
              image: found.image,
              status: found.status,
              reporter_name: found.reporter_name || found.finder_name,
              date_reported: found.date_reported || found.date_found,
            },
          });
        }
      } catch (e) {
        console.log(`Auto-match failed for lost#${lost.id}:`, e.message);
      }
    }

    if (!successfulComparisons) return res.status(503).json({ error: 'The AI service could not complete matching. Please try again.' });

    // Sort by score descending
    allMatches.sort((a, b) => b.score - a.score);

    res.json({
      matches: allMatches,
      lost_count: lostItems.length,
      found_count: foundItems.length,
    });
  } catch (err) {
    console.error('Auto-match error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/embed - Generate embeddings for an existing item (admin use)
 */
router.post('/embed', async (req, res) => {
  try {
    const { item_id, table } = req.body;

    if (!item_id || !table) {
      return res.status(400).json({ error: 'item_id and table are required' });
    }

    const { data: item, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', item_id)
      .single();

    if (error || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    let textEmb = null;
    if (item.description) {
      try {
        const textResp = await aiFetch(`${AI_URL}/embedding/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.description }),
        });
        if (textResp.ok) {
          const { embedding } = await textResp.json();
          textEmb = embedding;
        }
      } catch (e) {
        console.log('Text embedding failed:', e.message);
      }
    }

    let imageEmb = null;
    if (item.image) {
      let imageBase64 = null;
      if (item.image.startsWith('data:image')) {
        imageBase64 = item.image;
      } else if (item.image.startsWith('http')) {
        imageBase64 = await fetchImageAsBase64(item.image);
      }
      if (imageBase64) {
      try {
        const imgResp = await aiFetch(`${AI_URL}/embedding/image-base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64 }),
        });
        if (imgResp.ok) {
          const { embedding } = await imgResp.json();
          imageEmb = embedding;
        }
      } catch (e) {
        console.log('Image embedding failed:', e.message);
      }
    }
    }

    const updates = {};
    if (textEmb) updates.text_embedding = textEmb;
    if (imageEmb) updates.image_embedding = imageEmb;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Could not generate any embeddings' });
    }

    const { data: updated, error: updateError } = await supabase
      .from(table)
      .update(updates)
      .eq('id', item_id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ success: true, item_id, text_embedding_size: textEmb?.length || 0, image_embedding_size: imageEmb?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/batch-embed - Generate embeddings for all items without them
 * Set force=true to regenerate all embeddings (e.g. after model change)
 */
router.post('/batch-embed', async (req, res) => {
  try {
    const { table, force } = req.body;
    if (!table) return res.status(400).json({ error: 'table is required' });

    // When force=true, fetch ALL items regardless of existing embeddings
    let query = supabase.from(table).select('id, description, image').limit(100);
    if (!force) {
      query = query.or('image_embedding.is.null,text_embedding.is.null');
    }

    const { data: items, error } = await query;
    if (error) throw error;

    let processed = 0;
    let skipped = 0;
    for (const item of items) {
      try {
        const updates = {};

        // Regenerate text embedding if item has description (and either forced or missing)
        if (item.description && (force || !item.text_embedding)) {
          const textResp = await aiFetch(`${AI_URL}/embedding/text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: item.description }),
          });
          if (textResp.ok) {
            const { embedding } = await textResp.json();
            updates.text_embedding = embedding;
          }
        }

        // Regenerate image embedding if item has image (and either forced or missing)
        if (item.image && (force || !item.image_embedding)) {
          let imageBase64 = null;
          if (item.image.startsWith('data:image')) {
            imageBase64 = item.image;
          } else if (item.image.startsWith('http')) {
            imageBase64 = await fetchImageAsBase64(item.image);
          }
          if (imageBase64) {
          const imgResp = await aiFetch(`${AI_URL}/embedding/image-base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 }),
          });
          if (imgResp.ok) {
            const { embedding } = await imgResp.json();
            updates.image_embedding = embedding;
          }
        }
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from(table).update(updates).eq('id', item.id);
          processed++;
        } else {
          skipped++;
        }
      } catch (e) {
        console.log(`Failed to embed item #${item.id}:`, e.message);
        skipped++;
      }
    }

    res.json({ processed, skipped, total: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/match-for-item/:id/:table — Find match info for a given lost/found item
 * Uses activity logs to find the paired item (same approach as FTFVerificationForm).
 * Computes similarity scores directly from stored embeddings.
 */
router.get('/match-for-item/:id/:table', async (req, res) => {
  try {
    const { id, table } = req.params;
    if (!id || !table) return res.status(400).json({ error: 'id and table are required' });

    // Fetch this item
    const { data: thisItem, error: thisErr } = await supabase
      .from(table).select('*').eq('id', id).single();
    if (thisErr || !thisItem) return res.json({ match: null });

    // 1. Try activity logs first (most reliable, same as FTFVerificationForm)
    const { data: logs } = await supabase
      .from('activity_logs').select('*').eq('action', 'match')
      .order('timestamp', { ascending: false }).limit(50);

    const matchLog = (logs || []).find(log => {
      try {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        return details && (String(details.lost_item_id) === String(id) || String(details.found_item_id) === String(id));
      } catch { return false; }
    });

    let lostItemId, foundItemId;
    if (matchLog) {
      const details = typeof matchLog.details === 'string' ? JSON.parse(matchLog.details) : matchLog.details;
      lostItemId = details.lost_item_id;
      foundItemId = details.found_item_id;
    } else {
      // 2. Fallback: find opposite table item with potential_match and closest timestamp
      if (thisItem.status !== 'potential_match') return res.json({ match: null });
      const oppositeTable = table === 'lost_items' ? 'found_items' : 'lost_items';
      const ts = new Date(thisItem.last_updated).getTime();
      const { data: oppositeItems } = await supabase.from(oppositeTable).select('*').eq('status', 'potential_match').limit(100);
      let bestItem = null, minDiff = Infinity;
      for (const item of (oppositeItems || [])) {
        const diff = Math.abs(new Date(item.last_updated).getTime() - ts);
        if (diff < minDiff && diff < 30000) { minDiff = diff; bestItem = item; }
      }
      if (!bestItem) return res.json({ match: null });
      lostItemId = table === 'lost_items' ? id : bestItem.id;
      foundItemId = table === 'found_items' ? id : bestItem.id;
    }

    // Fetch both items
    const [lostRes, foundRes] = await Promise.all([
      supabase.from('lost_items').select('*').eq('id', lostItemId).single(),
      supabase.from('found_items').select('*').eq('id', foundItemId).single(),
    ]);
    const lostItem = lostRes.data || null;
    const foundItem = foundRes.data || null;
    if (!lostItem || !foundItem) return res.json({ match: null });

    // Compute similarity from embeddings
    let imgScore = 0, txtScore = 0;
    if (lostItem.image_embedding && foundItem.image_embedding) {
      try {
        const r = await aiFetch(`${AI_URL}/similarity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query_embedding: lostItem.image_embedding, stored_embeddings: [foundItem.image_embedding], top_k: 1 }),
        });
        if (r.ok) { const d = await r.json(); if (d.matches?.length > 0) imgScore = d.matches[0].score; }
      } catch {}
    }
    if (lostItem.text_embedding && foundItem.text_embedding) {
      try {
        const r = await aiFetch(`${AI_URL}/similarity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query_embedding: lostItem.text_embedding, stored_embeddings: [foundItem.text_embedding], top_k: 1 }),
        });
        if (r.ok) { const d = await r.json(); if (d.matches?.length > 0) txtScore = d.matches[0].score; }
      } catch {}
    }
    const hasImg = imgScore > 0, hasTxt = txtScore > 0;
    let score = 0;
    if (hasImg && hasTxt) score = 0.7 * imgScore + 0.3 * txtScore;
    else if (hasImg) score = imgScore;
    else if (hasTxt) score = txtScore;

    res.json({
      match: {
        score, image_score: imgScore, text_score: txtScore,
        lost_item: { id: lostItem.id, item_id: lostItem.item_id, description: lostItem.description, category_name: lostItem.category_name, location: lostItem.location_lost, location_details: lostItem.location_details, last_updated: lostItem.last_updated, image: lostItem.image, status: lostItem.status, reporter_name: lostItem.reporter_name, date_reported: lostItem.date_reported },
        found_item: { id: foundItem.id, item_id: foundItem.item_id, description: foundItem.description, category_name: foundItem.category_name, location: foundItem.location_found, location_details: foundItem.location_details, last_updated: foundItem.last_updated, condition: foundItem.condition, image: foundItem.image, status: foundItem.status, finder_name: foundItem.finder_name, date_found: foundItem.date_found },
      },
    });
  } catch (err) {
    console.error('Match lookup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/compute-match-scores — Compute similarity scores between two items by ID
 */
router.post('/compute-match-scores', async (req, res) => {
  try {
    const { lost_id, found_id } = req.body;
    if (!lost_id || !found_id) return res.status(400).json({ error: 'lost_id and found_id are required' });

    const [lostRes, foundRes] = await Promise.all([
      supabase.from('lost_items').select('text_embedding,image_embedding').eq('id', lost_id).single(),
      supabase.from('found_items').select('text_embedding,image_embedding').eq('id', found_id).single(),
    ]);

    const lostText = lostRes.data?.text_embedding;
    const lostImg = lostRes.data?.image_embedding;
    const foundText = foundRes.data?.text_embedding;
    const foundImg = foundRes.data?.image_embedding;

    let imageScore = 0;
    let textScore = 0;

    if (lostImg && foundImg) {
      try {
        const r = await aiFetch(`${AI_URL}/similarity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query_embedding: lostImg, stored_embeddings: [foundImg], top_k: 1 }),
        });
        if (r.ok) { const d = await r.json(); if (d.matches?.length > 0) imageScore = d.matches[0].score; }
      } catch {}
    }

    if (lostText && foundText) {
      try {
        const r = await aiFetch(`${AI_URL}/similarity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query_embedding: lostText, stored_embeddings: [foundText], top_k: 1 }),
        });
        if (r.ok) { const d = await r.json(); if (d.matches?.length > 0) textScore = d.matches[0].score; }
      } catch {}
    }

    const hasImage = imageScore > 0;
    const hasText = textScore > 0;
    let score = 0;
    if (hasImage && hasText) score = 0.7 * imageScore + 0.3 * textScore;
    else if (hasImage) score = imageScore;
    else if (hasText) score = textScore;

    res.json({ score, image_score: imageScore, text_score: textScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
