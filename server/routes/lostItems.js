import { backgroundTask } from '../services/backgroundTask.js';
import { aiFetch } from '../services/aiClient.js';
import { Router } from 'express';
import multer from 'multer';
import supabase from '../db.js';
import { readAll } from '../services/readAll.js';
import { requireReportLocation, parseLocationDetails } from '../services/reportLocations.js';
import { createRecoveryClaimHandler } from './recoveryFeedback.js';

const router = Router();

const logActivity = async (action, details, userName = 'Admin', role = 'admin') => {
  try {
    await supabase.from('activity_logs').insert({
      action, details, user_name: userName, role,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
};

const AI_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

// Generate embeddings in background (uses JSON base64 endpoint, NOT multipart)
const generateEmbeddings = async (itemId, table, imageUrl, description) => {
  try {
    const updates = {};

    // Text embedding
    if (description) {
      try {
        const r = await aiFetch(`${AI_URL}/embedding/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: description }),
        });
        if (r.ok) {
          const { embedding } = await r.json();
          updates.text_embedding = embedding;
          console.log(`  ✓ Text embedding generated for ${table}#${itemId} (${embedding.length} dims)`);
        } else {
          console.log(`  ✗ Text embedding failed for ${table}#${itemId}: HTTP ${r.status}`);
        }
      } catch (e) {
        console.log(`  ✗ Text embedding error for ${table}#${itemId}:`, e.message);
      }
    }

    // Image embedding — use base64 JSON endpoint (avoids Blob/FormData issues in Node.js)
    if (imageUrl) {
      try {
        let imageBase64 = imageUrl;
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) {
            const arrayBuffer = await imgResp.arrayBuffer();
            const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
            imageBase64 = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
          } else {
            console.log(`  ⚠ Could not fetch image URL for ${table}#${itemId}: HTTP ${imgResp.status}`);
            imageBase64 = null;
          }
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
            console.log(`  ✓ Image embedding generated for ${table}#${itemId} (${embedding.length} dims)`);
          } else {
            const errText = await r.text();
            console.log(`  ✗ Image embedding failed for ${table}#${itemId}: HTTP ${r.status} - ${errText}`);
          }
        }
      } catch (e) {
        console.log(`  ✗ Image embedding error for ${table}#${itemId}:`, e.message);
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from(table).update(updates).eq('id', itemId);
      console.log(`✅ Embeddings saved for ${table}#${itemId}: ${Object.keys(updates).join(', ')}`);
    } else {
      console.log(`⚠️ No embeddings generated for ${table}#${itemId}`);
    }
  } catch (e) {
    console.log(`❌ Embedding failed for ${table}#${itemId}:`, e.message);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Upload buffer to Supabase Storage, return public URL
const uploadBuffer = async (buffer, mimeType) => {
  try {
    const ext = mimeType.split('/')[1] || 'jpeg';
    const filename = `lost-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('lost-items')
      .upload(filename, buffer, { contentType: mimeType, upsert: false });
    if (error) { console.error('Supabase upload error:', error.message); return null; }
    const { data: { publicUrl } } = supabase.storage.from('lost-items').getPublicUrl(filename);
    return publicUrl;
  } catch (err) {
    console.error('Upload error:', err.message);
    return null;
  }
};

// Convert base64 to buffer and upload
const uploadBase64 = async (base64Data) => {
  if (!base64Data) return null;
  try {
    const matches = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return base64Data;
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const url = await uploadBuffer(buffer, mimeType);
    return url || base64Data;
  } catch (err) {
    console.error('Base64 upload error:', err.message);
    return base64Data;
  }
};

// POST /api/lost-items/upload (multipart file upload)
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { description, category_name, location_lost, reporter_name, reporter_id } = req.body;
    if (!description || !location_lost) {
      return res.status(400).json({ error: 'Description and location are required' });
    }
    const locationDetails = parseLocationDetails(req.body.location_details);
    const approvedLocation = await requireReportLocation(supabase, location_lost);
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadBuffer(req.file.buffer, req.file.mimetype);
      if (!imageUrl) {
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    }
    const { count } = await supabase.from('lost_items').select('*', { count: 'exact', head: true });
    const itemId = `LOST-${String((count || 0) + 1).padStart(4, '0')}`;
    const { data, error } = await supabase
      .from('lost_items')
      .insert({
        item_id: itemId, description,
        category_name: category_name || 'Miscellaneous',
        category_icon: '📦',
        location_lost: approvedLocation,
        location_details: locationDetails,
        reporter_name, reporter_id, image: imageUrl, status: 'active',
      })
      .select().single();
    if (error) throw error;
    await logActivity('report', `Lost item reported: ${data.item_id} — ${description}`, reporter_name || 'Admin');
    backgroundTask(generateEmbeddings(data.id, 'lost_items', imageUrl, description));
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/lost-items
router.get('/', async (req, res) => {
  try {
    const { search, status, category, sort } = req.query;
    let query = supabase.from('lost_items').select('*');
    if (status && status !== 'all') query = query.eq('status', status);
    if (category && category !== 'all') query = query.eq('category_name', category);
    const sortField = sort === 'status' ? 'status' : 'date_reported';
    query = query.order(sortField, { ascending: false }).order('id', { ascending: false });
    const data = await readAll(query);
    let filtered = data;
    if (search) {
      const q = search.toLowerCase();
      filtered = data.filter(item =>
        item.description.toLowerCase().includes(q) ||
        (item.item_id && item.item_id.toLowerCase().includes(q)) ||
        (item.reporter_name && item.reporter_name.toLowerCase().includes(q)) ||
        (item.location_lost && item.location_lost.toLowerCase().includes(q))
      );
    }
    res.json(filtered);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/lost-items/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lost_items')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Lost item not found' });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/lost-items (JSON body with optional base64 image)
router.post('/', async (req, res) => {
  try {
    const { description, category_id, category_name, category_icon, location_lost, reporter_name, reporter_id, image } = req.body;
    if (!description || !location_lost) {
      return res.status(400).json({ error: 'Description and location are required' });
    }
    const locationDetails = parseLocationDetails(req.body.location_details);
    const approvedLocation = await requireReportLocation(supabase, location_lost);
    const imageUrl = await uploadBase64(image);
    const { count } = await supabase.from('lost_items').select('*', { count: 'exact', head: true });
    const itemId = `LOST-${String((count || 0) + 1).padStart(4, '0')}`;
    const { data, error } = await supabase
      .from('lost_items')
      .insert({
        item_id: itemId, description,
        category_id: category_id || null,
        category_name: category_name || 'Miscellaneous',
        category_icon: category_icon || '📦',
        location_lost: approvedLocation,
        location_details: locationDetails,
        reporter_name, reporter_id, image: imageUrl, status: 'active',
      })
      .select().single();
    if (error) throw error;
    // Generate AI embeddings in background (don't block response)
    backgroundTask(generateEmbeddings(data.id, 'lost_items', imageUrl, description));
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /api/lost-items/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, cancel_reason } = req.body;
    const updates = { status, last_updated: new Date().toISOString() };
    if (status === 'resolved' || status === 'claimed') {
      updates.resolved_date = new Date().toISOString();
    }
    if (status === 'cancelled' && cancel_reason) {
      updates.cancel_reason = cancel_reason;
    }
    const { data, error } = await supabase
      .from('lost_items')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Lost item not found' });
    const action = status === 'cancelled' ? 'cancel' : status === 'resolved' ? 'resolve' : status === 'claimed' ? 'claim' : 'update';
    const logDetail = status === 'cancelled' && cancel_reason
      ? `Lost item ${data.item_id || req.params.id} cancelled. Reason: ${cancel_reason}`
      : `Lost item ${data.item_id || req.params.id} status changed to ${status}`;
    await logActivity(action, logDetail);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /api/lost-items/:id
router.put('/:id', async (req, res) => {
  try {
    const { description, category_id, category_name, category_icon, location_lost, image, status } = req.body;
    const updates = { last_updated: new Date().toISOString() };
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id;
    if (category_name !== undefined) updates.category_name = category_name;
    if (category_icon !== undefined) updates.category_icon = category_icon;
    if (location_lost !== undefined) updates.location_lost = await requireReportLocation(supabase, location_lost);
    if (req.body.location_details !== undefined) updates.location_details = parseLocationDetails(req.body.location_details);
    if (image !== undefined) updates.image = image;
    if (status !== undefined) updates.status = status;
    const { data, error } = await supabase
      .from('lost_items')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Lost item not found' });
    await logActivity('update', `Lost item ${req.params.id} updated`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/lost-items/:id/claim - FTF verification and claim
router.post('/:id/claim', createRecoveryClaimHandler());

// DELETE /api/lost-items/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('lost_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Lost item deleted successfully' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
