import { Router } from 'express';
import supabase from '../db.js';

const router = Router();

// GET /api/activity-logs
router.get('/', async (req, res) => {
  try {
    const { action, limit } = req.query;
    let query = supabase.from('activity_logs').select('*');

    if (action && action !== 'all') {
      query = query.eq('action', action);
    }

    query = query.order('timestamp', { ascending: false });

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/activity-logs
router.post('/', async (req, res) => {
  try {
    const { action, details, user_name, role } = req.body;
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .insert({ action, details, user_name, role })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;