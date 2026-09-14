import { Router } from 'express';
import supabase from '../db.js';

const router = Router();

// GET /api/qr-locations
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qr_locations')
      .select('*')
      .order('id');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/qr-locations/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qr_locations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'QR location not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/qr-locations
router.post('/', async (req, res) => {
  try {
    const { name, description, location, qr_code } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('qr_locations')
      .insert({ name, description, location, qr_code })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/qr-locations/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, location, qr_code, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (location !== undefined) updates.location = location;
    if (qr_code !== undefined) updates.qr_code = qr_code;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('qr_locations')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'QR location not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/qr-locations/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('qr_locations')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'QR location deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/qr-locations/:id/scan - Record a scan (increment counter)
router.post('/:id/scan', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qr_locations')
      .update({
        scan_count: supabase.raw('scan_count + 1'),
        last_scanned: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'QR location not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
