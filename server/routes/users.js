import { Router } from 'express';
import supabase from '../db.js';

const router = Router();
const publicColumns = 'id,name,email,student_id,phone,department,gender,role,status,avatar,items_reported,items_claimed,join_date,last_active';

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = supabase.from('users').select(publicColumns).order('id');

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter by search term if provided
    let filtered = data;
    if (search) {
      const q = search.toLowerCase();
      filtered = data.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.student_id && u.student_id.toLowerCase().includes(q))
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(publicColumns)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/status - Update user status (archive/restore/activate/suspend)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'archived', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ status, last_active: new Date().toISOString() })
      .eq('id', req.params.id)
      .select(publicColumns)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, department, student_id } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (department !== undefined) updates.department = department;
    if (student_id !== undefined) updates.student_id = student_id;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select(publicColumns)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;